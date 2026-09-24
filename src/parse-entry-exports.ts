import { lstatSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { isIdentifier, resolveStaticStringLiteral } from "./ast-guards";
import type { DeprecatedValue, JsDocPassthroughTag } from "./ComponentParser";
import { directoryEntry, directoryHasEntry, typeScriptCounterpart } from "./fs-listing";
import { extractJsDocDeprecatedAndTags, extractJsDocReturnType } from "./parser/jsdoc";
import { compareText } from "./parser/utils";
import { getParserStack, loadParserStack } from "./parser-stack";
import { normalizeSeparators } from "./path";
import { resolvePathAliasAbsolute } from "./resolve-alias";

/** One named export from the entry barrel (not a `.svelte` component). */
export interface EntryExport {
  name: string;
  kind: "const" | "let" | "var" | "function" | "class" | "type" | "interface" | "enum";
  /** Type text from the source, when present. */
  type?: string;
  /** Initializer text for simple constants. */
  value?: string;
  description?: string;
  /** From `@deprecated` JSDoc. */
  deprecated?: DeprecatedValue;
  /** `@since` / `@example` / `@see` tags in source order. */
  tags?: JsDocPassthroughTag[];
  /** True from `@ignore`/`@internal` JSDoc; excluded from every output by `buildComponentApiDocument`. */
  internal?: boolean;
  /** Declaring module, relative to the entry file. */
  source?: string;
  isTypeOnly: boolean;
}

export type EntryExports = EntryExport[];

/** Extensions probed when resolving a bare module specifier to a file. */
const CANDIDATE_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".d.ts"];

const NEWLINE_REGEX = /\r?\n/;
const JSDOC_LINE_PREFIX_REGEX = /^\s*\*+/;

/** Minimal AST node shape exposed by the Svelte/acorn-typescript parser. */
export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * Internal export with absolute `declFile` plus optional `returnType` for
 * function-valued exports (used by `resolve-call-defaults.ts`). Stripped
 * before public `EntryExport` output in `parseEntryExports`.
 */
export interface InternalExport extends Omit<EntryExport, "source"> {
  declFile: string;
  returnType?: string;
  /**
   * String from a literal or static-template initializer.
   * `resolve-context-keys.ts` uses this when a `setContext` key is imported.
   */
  literalValue?: string;
  /**
   * `export const` primitive literal (string, number, boolean, or a static
   * template). `resolve-const-defaults.ts` writes it as an imported prop default.
   */
  primitiveLiteral?: PrimitiveLiteral;
  /**
   * The function a function-valued export is declared as (`export function`,
   * or a `const` arrow/function expression). `resolve-dispatch-escapes.ts`
   * reads the events it dispatches through a parameter.
   */
  functionNode?: AstNode;
}

export interface PrimitiveLiteral {
  /** Initializer source text. */
  raw: string;
  value: string | number | boolean;
  type: "string" | "number" | "boolean";
}

/** Parsed-source context shared while walking a single module. */
interface ModuleSource {
  /** Full `<script lang="ts">`-wrapped source the offsets index into. */
  text: string;
  /** Absolute path of the parsed file. */
  filePath: string;
  /** Directory used to resolve relative imports. */
  dir: string;
}

/** Resolution state shared across the recursive module walk. */
export interface ResolveContext {
  /** Memoized exports per file so repeated lookups stay cheap. */
  cache: Map<string, InternalExport[]>;
  /** Files currently being resolved, used to break import cycles. */
  computing: Set<string>;
  /**
   * Called for a name two `export *` statements of `filePath` bring in from
   * different declarations. The module doesn't export such a name.
   */
  onAmbiguousStarExport?: (filePath: string, name: string, entries: InternalExport[]) => void;
}

function asNode(value: unknown): AstNode | undefined {
  return value && typeof value === "object" ? (value as AstNode) : undefined;
}

function asNodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? (value as AstNode[]) : [];
}

function identifierName(node: AstNode | undefined): string | undefined {
  return isIdentifier(node) ? node.name : undefined;
}

/**
 * Resolves a module specifier to an on-disk source file.
 *
 * Tries the path verbatim, with each candidate extension, then an
 * `index.*` file when the specifier points at a directory, and finally the
 * `.ts` file a missing `.js` specifier stands for.
 *
 * @example
 * ```ts
 * resolveModuleFile("./utils", "/abs/src") // "/abs/src/utils.ts"
 * ```
 */
export function resolveModuleFile(specifier: string, fromDir: string): string | null {
  const aliased = resolvePathAliasAbsolute(specifier, fromDir);
  const base = resolve(fromDir, aliased);
  const parentDir = dirname(base);
  const baseName = basename(base);

  if (directoryHasEntry(parentDir, baseName)) {
    // The cached listing already knows the entry's type; only a name that
    // matched by case/normalization variant (not in the listing under this
    // exact name) still needs the `lstat`.
    const entry = directoryEntry(parentDir, baseName);
    const stat = entry ?? lstatSync(base, { throwIfNoEntry: false });
    if (stat?.isFile()) return base;

    for (const ext of CANDIDATE_EXTENSIONS) {
      if (directoryHasEntry(parentDir, baseName + ext)) return base + ext;
    }

    if (stat?.isDirectory()) {
      for (const ext of CANDIDATE_EXTENSIONS) {
        if (directoryHasEntry(base, `index${ext}`)) return join(base, `index${ext}`);
      }
    }
    return null;
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    if (directoryHasEntry(parentDir, baseName + ext)) return base + ext;
  }

  return typeScriptCounterpart(base) ?? null;
}

function leadingJsDoc(text: string, start: number): string | undefined {
  // JSDoc must sit directly above the declaration (whitespace only); anchor on nearest `*/`.
  const before = text.slice(0, start).trimEnd();
  if (!before.endsWith("*/")) return undefined;

  const close = before.length - 2;
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return undefined;

  const description: string[] = [];
  for (const line of before.slice(open + 3, close).split(NEWLINE_REGEX)) {
    const cleaned = line.replace(JSDOC_LINE_PREFIX_REGEX, "").trim();
    if (cleaned.startsWith("@")) break;
    if (cleaned) description.push(cleaned);
  }

  return description.join(" ") || undefined;
}

/** Like {@link leadingJsDoc}, but returns the full `/** ... *\/` block. */
function leadingJsDocBlock(text: string, start: number): string | undefined {
  const before = text.slice(0, start).trimEnd();
  if (!before.endsWith("*/")) return undefined;

  const close = before.length - 2;
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return undefined;

  return before.slice(open, close + 2);
}

function textOf(source: ModuleSource, node: AstNode | undefined): string | undefined {
  if (!node) return undefined;
  return source.text.slice(node.start, node.end);
}

function annotationText(source: ModuleSource, annotated: AstNode | undefined): string | undefined {
  const annotation = asNode(annotated?.typeAnnotation);
  if (annotation?.type !== "TSTypeAnnotation") return undefined;
  return textOf(source, asNode(annotation.typeAnnotation));
}

/**
 * Function/arrow/`TSDeclareFunction` return annotation text (`): T`).
 * Lives on `returnType`, not `typeAnnotation` (that annotates bindings).
 */
function functionReturnAnnotationText(source: ModuleSource, fn: AstNode): string | undefined {
  const returnAnnotation = asNode(fn.returnType);
  return returnAnnotation?.type === "TSTypeAnnotation"
    ? textOf(source, asNode(returnAnnotation.typeAnnotation))
    : undefined;
}

function buildSignature(source: ModuleSource, fn: AstNode): string {
  const params = asNodeArray(fn.params)
    .map((param) => textOf(source, param) ?? "")
    .join(", ");
  const returnType = functionReturnAnnotationText(source, fn);
  return `(${params})${returnType ? ` => ${returnType}` : ""}`;
}

function inferLiteralType(init: AstNode): string | undefined {
  if (init.type === "Literal") {
    const value = init.value;
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
  }
  if (init.type === "TemplateLiteral") return "string";
  return undefined;
}

/** `300`, `-1`, `"a"`, `true`, or a template with no expressions. */
function primitiveLiteralOf(source: ModuleSource, init: AstNode): PrimitiveLiteral | undefined {
  const raw = textOf(source, init);
  if (raw === undefined) return undefined;

  if (init.type === "Literal") {
    const value = init.value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return { raw, value, type: typeof value as PrimitiveLiteral["type"] };
    }
    return undefined;
  }

  if (init.type === "UnaryExpression" && init.operator === "-") {
    const argument = asNode(init.argument);
    if (argument?.type === "Literal" && typeof argument.value === "number") {
      return { raw, value: -argument.value, type: "number" };
    }
    return undefined;
  }

  const templateValue = init.type === "TemplateLiteral" ? resolveStaticStringLiteral(init) : null;
  return templateValue === null ? undefined : { raw, value: templateValue, type: "string" };
}

/** Trailing return from a callable type (`() => string` → `string`). */
function returnTypeFromCallableTypeText(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const idx = type.lastIndexOf("=>");
  if (idx === -1) return undefined;
  const ret = type.slice(idx + 2).trim();
  return ret || undefined;
}

/**
 * Literal-only return inference for a function/arrow (same idea as
 * `inferReturnTypeFromNode` in props.ts). string/number/boolean/template only.
 */
function inferAstLiteralReturnType(fn: AstNode): string | undefined {
  if (fn.async || fn.generator) return undefined;

  const body = asNode(fn.body);
  if (!body) return undefined;

  const returnArgs: Array<AstNode | null> = [];
  if (body.type === "BlockStatement") {
    collectAstReturnArguments(body, returnArgs);
    if (returnArgs.length === 0) return undefined;
  } else {
    returnArgs.push(body);
  }

  let inferred: string | undefined;
  for (const arg of returnArgs) {
    if (!arg) return undefined;
    const primitive = inferLiteralType(arg);
    if (!primitive) return undefined;
    if (inferred === undefined) inferred = primitive;
    else if (inferred !== primitive) return undefined;
  }
  return inferred;
}

function collectAstReturnArguments(body: AstNode, out: Array<AstNode | null>): void {
  for (const statement of asNodeArray(body.body)) {
    if (
      statement.type === "FunctionDeclaration" ||
      statement.type === "FunctionExpression" ||
      statement.type === "ArrowFunctionExpression"
    ) {
      continue;
    }
    if (statement.type === "ReturnStatement") {
      out.push(asNode(statement.argument) ?? null);
      continue;
    }
    // Nested blocks (if/for/while) without entering nested functions.
    if (statement.type === "BlockStatement") {
      collectAstReturnArguments(statement, out);
      continue;
    }
    const consequent = asNode(statement.consequent);
    if (consequent?.type === "BlockStatement") collectAstReturnArguments(consequent, out);
    else if (consequent?.type === "ReturnStatement") out.push(asNode(consequent.argument) ?? null);
    const alternate = asNode(statement.alternate);
    if (alternate?.type === "BlockStatement") collectAstReturnArguments(alternate, out);
    else if (alternate?.type === "ReturnStatement") out.push(asNode(alternate.argument) ?? null);
    const blockBody = asNode(statement.body);
    if (blockBody?.type === "BlockStatement") collectAstReturnArguments(blockBody, out);
  }
}

/** A `TSEnumMember`'s literal initializer value, or `undefined` for anything not a plain string/number literal. */
function enumMemberLiteralValue(member: AstNode): string | number | undefined {
  const initializer = asNode(member.initializer);
  if (!initializer) return undefined;

  if (initializer.type === "Literal") {
    const value = (initializer as unknown as { value: unknown }).value;
    return typeof value === "string" || typeof value === "number" ? value : undefined;
  }

  // Negative numeric literals parse as `UnaryExpression` (`-1`), not `Literal`.
  if (initializer.type === "UnaryExpression") {
    const argument = asNode((initializer as unknown as { argument?: unknown }).argument);
    const operator = (initializer as unknown as { operator?: string }).operator;
    if (operator === "-" && argument?.type === "Literal") {
      const value = (argument as unknown as { value: unknown }).value;
      if (typeof value === "number") return -value;
    }
  }

  return undefined;
}

/**
 * Builds a literal union type for a `TSEnumDeclaration` (`"A" | "B"` for a
 * string enum, `0 | 1` for a numeric one), matching what the enum's members
 * actually widen to. Falls back to `undefined` (letting the caller keep the
 * bare enum name) when a member's value can't be determined - e.g. a
 * computed initializer like `1 << 2`.
 */
function enumMemberUnionType(declaration: AstNode): string | undefined {
  const members = asNodeArray(declaration.members);
  if (members.length === 0) return undefined;

  const literals: string[] = [];
  let nextNumeric = 0;
  for (const member of members) {
    const initializer = asNode(member.initializer);
    if (!initializer) {
      literals.push(String(nextNumeric));
      nextNumeric += 1;
      continue;
    }

    const value = enumMemberLiteralValue(member);
    if (value === undefined) return undefined;

    literals.push(typeof value === "string" ? JSON.stringify(value) : String(value));
    nextNumeric = typeof value === "number" ? value + 1 : nextNumeric;
  }

  return literals.join(" | ");
}

function describeDeclaration(source: ModuleSource, declaration: AstNode, jsdocStart: number): InternalExport[] {
  const declFile = source.filePath;
  const description = leadingJsDoc(source.text, jsdocStart);
  const rawJsDoc = leadingJsDocBlock(source.text, jsdocStart);
  const jsDocReturnType = rawJsDoc ? extractJsDocReturnType(rawJsDoc) : undefined;
  const { deprecated, tags, internal } = rawJsDoc
    ? extractJsDocDeprecatedAndTags(rawJsDoc)
    : { deprecated: undefined, tags: undefined, internal: false };
  const internalField = internal ? ({ internal: true } as const) : {};

  if (declaration.type === "VariableDeclaration") {
    const kind = (declaration.kind as "const" | "let" | "var") ?? "const";
    const results: InternalExport[] = [];

    for (const declarator of asNodeArray(declaration.declarations)) {
      const id = asNode(declarator.id);
      const name = identifierName(id);
      if (!name) continue;

      let type = annotationText(source, id);
      let value: string | undefined;
      let returnType: string | undefined;
      let literalValue: string | undefined;
      let primitiveLiteral: PrimitiveLiteral | undefined;
      let functionNode: AstNode | undefined;
      const init = asNode(declarator.init);

      if (init) {
        if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
          functionNode = init;
          if (!type) type = buildSignature(source, init);
          returnType =
            functionReturnAnnotationText(source, init) ??
            jsDocReturnType ??
            returnTypeFromCallableTypeText(type) ??
            inferAstLiteralReturnType(init);
        } else {
          value = textOf(source, init);
          if (!type) type = inferLiteralType(init);
          literalValue = resolveStaticStringLiteral(init) ?? undefined;
          if (kind === "const") primitiveLiteral = primitiveLiteralOf(source, init);
        }
      }

      results.push({
        name,
        kind,
        type,
        value,
        returnType,
        literalValue,
        primitiveLiteral,
        functionNode,
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: false,
      });
    }

    return results;
  }

  // Ambient signature in a `.d.ts`: `export function uniqueId(prefix?: string): string;`
  if (declaration.type === "FunctionDeclaration" || declaration.type === "TSDeclareFunction") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      {
        name,
        kind: "function",
        type: buildSignature(source, declaration),
        returnType:
          functionReturnAnnotationText(source, declaration) ??
          jsDocReturnType ??
          inferAstLiteralReturnType(declaration),
        ...(declaration.type === "FunctionDeclaration" ? { functionNode: declaration } : {}),
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: false,
      },
    ];
  }

  if (declaration.type === "ClassDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      { name, kind: "class", type: name, description, deprecated, tags, ...internalField, declFile, isTypeOnly: false },
    ];
  }

  if (declaration.type === "TSTypeAliasDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      {
        name,
        kind: "type",
        type: textOf(source, asNode(declaration.typeAnnotation)),
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: true,
      },
    ];
  }

  if (declaration.type === "TSInterfaceDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      {
        name,
        kind: "interface",
        type: textOf(source, asNode(declaration.body)),
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: true,
      },
    ];
  }

  if (declaration.type === "TSEnumDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      {
        name,
        kind: "enum",
        type: enumMemberUnionType(declaration) ?? name,
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: false,
      },
    ];
  }

  return [];
}

/**
 * Parses a module file into the top-level statements of its script body.
 *
 * The source is wrapped in `<script lang="ts">` so the Svelte parser
 * (backed by acorn-typescript) yields a TypeScript-aware AST with byte
 * offsets for verbatim text extraction.
 */
function parseModule(filePath: string): { source: ModuleSource; body: AstNode[] } | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const text = `<script lang="ts">\n${raw}\n</script>`;

  try {
    const ast = getParserStack().parseSvelte(text) as { instance?: { content?: { body?: unknown } } };
    const body = asNodeArray(ast.instance?.content?.body);
    return { source: { text, filePath, dir: dirname(filePath) }, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Failed to parse entry export module ${filePath}: ${message}`);
    return null;
  }
}

function findImportSource(body: AstNode[], name: string): { specifier: string; importedName: string } | null {
  for (const node of body) {
    if (node.type !== "ImportDeclaration") continue;
    const specifierValue = asNode(node.source)?.value;
    if (typeof specifierValue !== "string") continue;

    for (const specifier of asNodeArray(node.specifiers)) {
      if (specifier.type !== "ImportSpecifier") continue;
      if (identifierName(asNode(specifier.local)) === name) {
        const importedName = identifierName(asNode(specifier.imported)) ?? name;
        return { specifier: specifierValue, importedName };
      }
    }
  }

  return null;
}

/**
 * Collects every named export declared or re-exported by a module.
 *
 * Walks `export ... from` and `export *` chains. Skips `.svelte` re-exports.
 */
export function collectModuleExports(filePath: string, ctx: ResolveContext): InternalExport[] {
  const cached = ctx.cache.get(filePath);
  if (cached) return cached;
  // A module currently being resolved is part of an import cycle.
  if (ctx.computing.has(filePath)) return [];
  ctx.computing.add(filePath);

  const parsed = parseModule(filePath);
  if (!parsed) {
    ctx.computing.delete(filePath);
    ctx.cache.set(filePath, []);
    return [];
  }

  const { source, body } = parsed;
  const results: InternalExport[] = [];

  /** Local declarations indexed by name for `export { x }` lookups. */
  const localDeclarations = new Map<string, InternalExport>();
  for (const node of body) {
    const declaration = node.type === "ExportNamedDeclaration" ? asNode(node.declaration) : node;
    if (!declaration) continue;
    for (const described of describeDeclaration(source, declaration, declaration.start)) {
      localDeclarations.set(described.name, described);
    }
  }

  /** Resolves a name within `filePath`, following one level of import. */
  const resolveLocal = (name: string): InternalExport | null => {
    const local = localDeclarations.get(name);
    if (local) return local;

    const imported = findImportSource(body, name);
    if (!imported || imported.specifier.endsWith(".svelte")) return null;

    const target = resolveModuleFile(imported.specifier, source.dir);
    if (!target) return null;

    return findModuleExport(collectModuleExports(target, ctx), imported.importedName) ?? null;
  };

  /** Entries each `export *` brings in, by name; merged after the explicit exports below. */
  const starExports = new Map<string, InternalExport[]>();

  for (const node of body) {
    if (node.type === "ExportAllDeclaration") {
      const specifierValue = asNode(node.source)?.value;
      if (typeof specifierValue !== "string" || specifierValue.endsWith(".svelte")) continue;
      const target = resolveModuleFile(specifierValue, source.dir);
      if (!target) continue;
      const isTypeOnly = node.exportKind === "type";
      for (const entry of collectModuleExports(target, ctx)) {
        const entries = starExports.get(entry.name) ?? [];
        entries.push(isTypeOnly ? { ...entry, isTypeOnly: true } : entry);
        starExports.set(entry.name, entries);
      }
      continue;
    }

    if (node.type !== "ExportNamedDeclaration") continue;

    // Inline `export const/function/class/type/interface/enum`.
    const declaration = asNode(node.declaration);
    if (declaration) {
      results.push(...describeDeclaration(source, declaration, node.start));
      continue;
    }

    const specifierValue = asNode(node.source)?.value;
    const moduleSpecifier = typeof specifierValue === "string" ? specifierValue : undefined;
    if (moduleSpecifier?.endsWith(".svelte")) continue;

    const stmtIsTypeOnly = node.exportKind === "type";

    for (const specifier of asNodeArray(node.specifiers)) {
      if (specifier.type !== "ExportSpecifier") continue;
      const exportedName = identifierName(asNode(specifier.exported));
      const localName = identifierName(asNode(specifier.local));
      if (!exportedName || !localName || localName === "default" || exportedName === "default") continue;

      const elementIsTypeOnly = stmtIsTypeOnly || specifier.exportKind === "type";

      let resolved: InternalExport | null = null;
      if (moduleSpecifier) {
        const target = resolveModuleFile(moduleSpecifier, source.dir);
        if (target) {
          resolved = findModuleExport(collectModuleExports(target, ctx), localName) ?? null;
        }
      } else {
        resolved = resolveLocal(localName);
      }

      if (resolved?.declFile.endsWith(".svelte")) continue;

      if (resolved) {
        results.push({ ...resolved, name: exportedName, isTypeOnly: resolved.isTypeOnly || elementIsTypeOnly });
      } else {
        results.push({
          name: exportedName,
          kind: elementIsTypeOnly ? "type" : "const",
          declFile: filePath,
          isTypeOnly: elementIsTypeOnly,
        });
      }
    }
  }

  // Same rules as ES module linking: a name the module exports explicitly
  // shadows every `export *` of it, and a name two stars bring in from
  // different declarations is ambiguous, so the module doesn't export it.
  // Entries from one file are one declaration (or its overloads).
  const explicitNames = new Set(results.map((entry) => entry.name));
  for (const [name, entries] of starExports) {
    if (explicitNames.has(name)) continue;
    if (entries.every((entry) => entry.declFile === entries[0].declFile)) {
      results.push(...entries);
    } else {
      ctx.onAmbiguousStarExport?.(filePath, name, entries);
    }
  }

  ctx.computing.delete(filePath);
  ctx.cache.set(filePath, results);
  return results;
}

/**
 * The entry for `name` in a module's export list, or `undefined`.
 *
 * `findLast`, not `find`: overloaded declarations (`export function f(...): A;` /
 * `export function f(...): B;` / `export function f(...) { ... }`) all describe
 * to the same name, in source order, with the implementation last. Any other
 * name appears at most once (see {@link collectModuleExports}).
 */
export function findModuleExport(exports: InternalExport[], name: string): InternalExport | undefined {
  return exports.findLast((entry) => entry.name === name);
}

/**
 * List consts, functions, and types exported from an entry barrel.
 *
 * Follows re-exports with AST-only traversal. Skips `.svelte` files.
 *
 * @param entryFile - Absolute path to the entry module.
 * @returns Exports deduplicated by name, sorted alphabetically.
 *
 * @example
 * ```ts
 * // entry: export { VERSION } from "./constants"; export type { Theme } from "./types";
 * await parseEntryExports("/abs/src/index.ts");
 * // [{ name: "Theme", kind: "type", isTypeOnly: true, ... }, { name: "VERSION", kind: "const", ... }]
 * ```
 */
export async function parseEntryExports(entryFile: string): Promise<EntryExports> {
  await loadParserStack();

  const resolved = resolve(entryFile);
  const entryDir = dirname(resolved);
  const relativeSource = (declFile: string) => normalizeSeparators(`./${relative(entryDir, declFile)}`);

  // A name two of the entry's `export *` statements bring in from different
  // files is ambiguous, so the module doesn't export it. The docs keep the
  // first declaration anyway, with a warning, rather than drop it silently.
  const ambiguous: InternalExport[] = [];
  const collected = collectModuleExports(resolved, {
    cache: new Map(),
    computing: new Set(),
    onAmbiguousStarExport: (filePath, name, entries) => {
      if (filePath !== resolved) return;
      const firstDeclFile = entries[0].declFile;
      const otherDeclFiles = new Set(entries.map((entry) => entry.declFile));
      otherDeclFiles.delete(firstDeclFile);
      console.warn(
        `Warning: "${name}" is exported from both "${relativeSource(firstDeclFile)}" and "${Array.from(
          otherDeclFiles,
          relativeSource,
        ).join('", "')}"; keeping the first and dropping the rest.`,
      );
      ambiguous.push(...entries.filter((entry) => entry.declFile === firstDeclFile));
    },
  });

  const byName = new Map<string, EntryExport>();
  // Entries sharing a name are one declaration's overloads; the last (the
  // implementation signature) wins.
  for (const entry of [...collected, ...ambiguous]) {
    // Drop internal returnType/literalValue/primitiveLiteral/functionNode; public EntryExport does not expose them.
    const {
      declFile,
      returnType: _returnType,
      literalValue: _literalValue,
      primitiveLiteral: _primitiveLiteral,
      functionNode: _functionNode,
      ...rest
    } = entry;
    byName.set(entry.name, { ...rest, source: relativeSource(declFile) });
  }

  return Array.from(byName.values()).sort((a, b) => compareText(a.name, b.name));
}
