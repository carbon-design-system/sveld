import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "svelte/compiler";
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
  /** Declaring module, relative to the entry file. */
  source?: string;
  isTypeOnly: boolean;
}

export type EntryExports = EntryExport[];

/** Extensions probed when resolving a bare module specifier to a file. */
const CANDIDATE_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".d.ts"];

/** Splits a JSDoc comment body into lines. */
const NEWLINE_REGEX = /\r?\n/;
/** Strips leading whitespace and asterisks from a JSDoc line. */
const JSDOC_LINE_PREFIX_REGEX = /^\s*\*+/;

/** Minimal AST node shape exposed by the Svelte/acorn-typescript parser. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** Internal export record that tracks the absolute declaring file. */
interface InternalExport extends Omit<EntryExport, "source"> {
  declFile: string;
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
interface ResolveContext {
  /** Memoized exports per file so repeated lookups stay cheap. */
  cache: Map<string, InternalExport[]>;
  /** Files currently being resolved, used to break import cycles. */
  computing: Set<string>;
}

function asNode(value: unknown): AstNode | undefined {
  return value && typeof value === "object" ? (value as AstNode) : undefined;
}

function asNodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? (value as AstNode[]) : [];
}

function identifierName(node: AstNode | undefined): string | undefined {
  if (node && node.type === "Identifier" && typeof node.name === "string") return node.name as string;
  return undefined;
}

/**
 * Resolves a module specifier to an on-disk source file.
 *
 * Tries the path verbatim, with each candidate extension, and finally an
 * `index.*` file when the specifier points at a directory.
 *
 * @example
 * ```ts
 * resolveModuleFile("./utils", "/abs/src") // "/abs/src/utils.ts"
 * ```
 */
function resolveModuleFile(specifier: string, fromDir: string): string | null {
  const aliased = resolvePathAliasAbsolute(specifier, fromDir);
  const base = resolve(fromDir, aliased);

  if (existsSync(base) && lstatSync(base).isFile()) return base;

  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }

  if (existsSync(base) && lstatSync(base).isDirectory()) {
    for (const ext of CANDIDATE_EXTENSIONS) {
      const candidate = join(base, `index${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

/** Reads and cleans the JSDoc block immediately preceding `start`, if any. */
function leadingJsDoc(text: string, start: number): string | undefined {
  // Only a JSDoc block directly adjacent to the declaration (separated by
  // whitespace alone) documents it. Anchor to the nearest `*/` so earlier
  // comments and intervening code are never absorbed.
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

/** Slices the verbatim source text spanned by a node. */
function textOf(source: ModuleSource, node: AstNode | undefined): string | undefined {
  if (!node) return undefined;
  return source.text.slice(node.start, node.end);
}

/** Extracts the annotated type text from a `TSTypeAnnotation`, if present. */
function annotationText(source: ModuleSource, annotated: AstNode | undefined): string | undefined {
  const annotation = asNode(annotated?.typeAnnotation);
  if (annotation?.type !== "TSTypeAnnotation") return undefined;
  return textOf(source, asNode(annotation.typeAnnotation));
}

/** Builds a callable type signature from a function-like node. */
function buildSignature(source: ModuleSource, fn: AstNode): string {
  const params = asNodeArray(fn.params)
    .map((param) => textOf(source, param) ?? "")
    .join(", ");
  // Functions and arrows expose their return type via `returnType`.
  const returnAnnotation = asNode(fn.returnType);
  const returnType =
    returnAnnotation?.type === "TSTypeAnnotation" ? textOf(source, asNode(returnAnnotation.typeAnnotation)) : undefined;
  return `(${params})${returnType ? ` => ${returnType}` : ""}`;
}

/** Infers a primitive type name from a literal initializer. */
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

/** Pull type text from a declaration node. */
function describeDeclaration(source: ModuleSource, declaration: AstNode, jsdocStart: number): InternalExport[] {
  const declFile = source.filePath;
  const description = leadingJsDoc(source.text, jsdocStart);

  if (declaration.type === "VariableDeclaration") {
    const kind = (declaration.kind as "const" | "let" | "var") ?? "const";
    const results: InternalExport[] = [];

    for (const declarator of asNodeArray(declaration.declarations)) {
      const id = asNode(declarator.id);
      const name = identifierName(id);
      if (!name) continue;

      let type = annotationText(source, id);
      let value: string | undefined;
      const init = asNode(declarator.init);

      if (init) {
        if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
          if (!type) type = buildSignature(source, init);
        } else {
          value = textOf(source, init);
          if (!type) type = inferLiteralType(init);
        }
      }

      results.push({ name, kind, type, value, description, declFile, isTypeOnly: false });
    }

    return results;
  }

  if (declaration.type === "FunctionDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [
      { name, kind: "function", type: buildSignature(source, declaration), description, declFile, isTypeOnly: false },
    ];
  }

  if (declaration.type === "ClassDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [{ name, kind: "class", type: name, description, declFile, isTypeOnly: false }];
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
        declFile,
        isTypeOnly: true,
      },
    ];
  }

  if (declaration.type === "TSEnumDeclaration") {
    const name = identifierName(asNode(declaration.id));
    if (!name) return [];
    return [{ name, kind: "enum", type: name, description, declFile, isTypeOnly: false }];
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
    const ast = parse(text, { modern: true }) as { instance?: { content?: { body?: unknown } } };
    const body = asNodeArray(ast.instance?.content?.body);
    return { source: { text, filePath, dir: dirname(filePath) }, body };
  } catch {
    return null;
  }
}

/** Finds the module a local name was imported from, if any. */
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
function collectModuleExports(filePath: string, ctx: ResolveContext): InternalExport[] {
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

    return collectModuleExports(target, ctx).find((entry) => entry.name === imported.importedName) ?? null;
  };

  for (const node of body) {
    if (node.type === "ExportAllDeclaration") {
      const specifierValue = asNode(node.source)?.value;
      if (typeof specifierValue !== "string" || specifierValue.endsWith(".svelte")) continue;
      const target = resolveModuleFile(specifierValue, source.dir);
      if (!target) continue;
      const isTypeOnly = node.exportKind === "type";
      for (const entry of collectModuleExports(target, ctx)) {
        results.push(isTypeOnly ? { ...entry, isTypeOnly: true } : entry);
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
          resolved = collectModuleExports(target, ctx).find((entry) => entry.name === localName) ?? null;
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

  ctx.computing.delete(filePath);
  ctx.cache.set(filePath, results);
  return results;
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
 * parseEntryExports("/abs/src/index.ts");
 * // [{ name: "Theme", kind: "type", isTypeOnly: true, ... }, { name: "VERSION", kind: "const", ... }]
 * ```
 */
export function parseEntryExports(entryFile: string): EntryExports {
  const resolved = resolve(entryFile);
  const entryDir = dirname(resolved);
  const collected = collectModuleExports(resolved, { cache: new Map(), computing: new Set() });

  const byName = new Map<string, EntryExport>();
  for (const entry of collected) {
    const { declFile, ...rest } = entry;
    const source = normalizeSeparators(`./${relative(entryDir, declFile)}`);
    byName.set(entry.name, { ...rest, source });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
