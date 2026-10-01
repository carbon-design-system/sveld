import { resolve } from "node:path";
import type {
  ArrowFunctionExpression,
  BlockStatement,
  Declaration,
  ExportDefaultDeclaration,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  MaybeNamedClassDeclaration,
  MaybeNamedFunctionDeclaration,
  Node,
  Pattern,
  Program,
  Statement,
  TSDeclareFunction,
  TSEnumDeclaration,
  TSEnumMember,
} from "sveast";
import { resolveStaticStringLiteral, unwrapTypeCastExpression } from "./ast-guards";
import type { ModuleGraph, ModuleSource } from "./module-graph";
import type { EntryExport } from "./parse-entry-exports";
import { parseComments } from "./parser/comment-parser";
import { getParserStack } from "./parser-stack";
import { returnTypeOfFunctionType } from "./type-text";

const NEWLINE_REGEX = /\r?\n/;

/** A function a function-valued export is declared as. */
export type ExportedFunction =
  | FunctionDeclaration
  | MaybeNamedFunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression;

/** A function, or an ambient `declare function` signature with no body. */
type FunctionLike = ExportedFunction | TSDeclareFunction;

/** A top-level statement, or the declaration an `export` statement wraps. */
type DeclarationLike =
  | Program["body"][number]
  | Declaration
  | MaybeNamedClassDeclaration
  | MaybeNamedFunctionDeclaration;
const JSDOC_LINE_PREFIX_REGEX = /^\s*\*+/;

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
   * A `const`'s TypeScript annotation or JSDoc `@type`, when it names no
   * types that would be out of scope in another file (`"a" | "b"`, not
   * `Size`). `resolve-const-defaults.ts` types an imported prop default with
   * it, as a same-file `const` would be.
   */
  declaredType?: { type: string; source: "typescript" | "jsdoc" };
  /**
   * The function a function-valued export is declared as (`export function`,
   * or a `const` arrow/function expression). `resolve-dispatch-escapes.ts`
   * reads the events it dispatches through a parameter.
   */
  functionNode?: ExportedFunction;
  /**
   * The module a namespace export (`export * as ns from "./x"`, or an
   * `import * as ns` the module re-exports) is the namespace object of. Its
   * members aren't exports of this module; {@link findImportedExport}
   * reads `ns.member` through it.
   */
  namespaceFile?: string;
}

export interface PrimitiveLiteral {
  /** Initializer source text. */
  raw: string;
  value: string | number | boolean;
  type: "string" | "number" | "boolean";
}

/** Resolution state shared across the recursive module walk. */
export interface ResolveContext {
  /** Resolves specifiers and parses modules; shared by every context of a project. */
  graph: ModuleGraph;
  /**
   * Memoized exports per file so repeated lookups stay cheap. Unlike a
   * parse, which depends only on the file, a cycle cut short can leave an
   * entry incomplete, so each lookup that must not depend on another's
   * order gets its own.
   */
  cache: Map<string, InternalExport[]>;
  /** Files currently being resolved, used to break import cycles. */
  computing: Set<string>;
  /**
   * Called for a name two `export *` statements of `filePath` bring in from
   * different declarations. The module doesn't export such a name.
   */
  onAmbiguousStarExport?: (filePath: string, name: string, entries: InternalExport[]) => void;
}

/** A fresh cache and cycle set, parsing modules through `graph`. */
export function createResolveContext(graph: ModuleGraph): ResolveContext {
  return { graph, cache: new Map(), computing: new Set() };
}

function identifierName(node: Node | null | undefined): string | undefined {
  return node?.type === "Identifier" ? node.name : undefined;
}

/**
 * `text` without the comments that may sit between a JSDoc block and its
 * declaration: whole `//` lines and `/* *\/` blocks that aren't JSDoc.
 */
function withoutTrailingComments(text: string): string {
  let rest = text.trimEnd();
  for (;;) {
    const lineStart = rest.lastIndexOf("\n") + 1;
    if (rest.slice(lineStart).trimStart().startsWith("//")) {
      rest = rest.slice(0, lineStart).trimEnd();
      continue;
    }
    const open = rest.endsWith("*/") ? rest.lastIndexOf("/*", rest.length - 3) : -1;
    if (open !== -1 && rest[open + 2] !== "*") {
      rest = rest.slice(0, open).trimEnd();
      continue;
    }
    return rest;
  }
}

/** The `/** ... *\/` block directly before `start`, if any. */
function leadingJsDocBlock(text: string, start: number): string | undefined {
  // JSDoc must sit directly above the declaration (whitespace or other comments only); anchor on nearest `*/`.
  const before = withoutTrailingComments(text.slice(0, start));
  if (!before.endsWith("*/")) return undefined;

  const close = before.length - 2;
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return undefined;

  return before.slice(open, close + 2);
}

/** A JSDoc block's description: its text up to the first tag, joined into one line. */
function jsDocDescription(block: string): string | undefined {
  const description: string[] = [];
  for (const line of block.slice(3, -2).split(NEWLINE_REGEX)) {
    const cleaned = line.replace(JSDOC_LINE_PREFIX_REGEX, "").trim();
    if (cleaned.startsWith("@")) break;
    if (cleaned) description.push(cleaned);
  }

  return description.join(" ") || undefined;
}

function textOf(source: ModuleSource, node: { start: number; end: number } | undefined): string | undefined {
  if (!node) return undefined;
  return source.text.slice(node.start, node.end);
}

function annotationText(source: ModuleSource, annotated: Pattern): string | undefined {
  return "typeAnnotation" in annotated ? textOf(source, annotated.typeAnnotation?.typeAnnotation) : undefined;
}

/**
 * Function/arrow/`TSDeclareFunction` return annotation text (`): T`).
 * Lives on `returnType`, not `typeAnnotation` (that annotates bindings).
 */
function functionReturnAnnotationText(source: ModuleSource, fn: FunctionLike): string | undefined {
  return textOf(source, fn.returnType?.typeAnnotation);
}

function buildSignature(source: ModuleSource, fn: FunctionLike): string {
  const params = fn.params.map((param) => textOf(source, param) ?? "").join(", ");
  const returnType = functionReturnAnnotationText(source, fn);
  return `(${params})${returnType ? ` => ${returnType}` : ""}`;
}

function inferLiteralType(init: Expression): string | undefined {
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
function primitiveLiteralOf(source: ModuleSource, init: Expression): PrimitiveLiteral | undefined {
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
    const argument = init.argument;
    if (argument.type === "Literal" && typeof argument.value === "number") {
      return { raw, value: -argument.value, type: "number" };
    }
    return undefined;
  }

  const templateValue = init.type === "TemplateLiteral" ? resolveStaticStringLiteral(init) : null;
  return templateValue === null ? undefined : { raw, value: templateValue, type: "string" };
}

/**
 * The context key a `Symbol("theme")` / `Symbol.for("theme")` initializer
 * stands for, as `setContext` with a same-file key reads it: its static
 * description, or the binding name when it has none.
 */
function symbolKeyDescription(init: Expression, bindingName: string): string | undefined {
  if (init.type !== "CallExpression" && init.type !== "NewExpression") return undefined;
  const callee = init.callee;
  const isSymbol =
    identifierName(callee) === "Symbol" ||
    (callee.type === "MemberExpression" &&
      !callee.computed &&
      identifierName(callee.object) === "Symbol" &&
      identifierName(callee.property) === "for");
  if (!isSymbol) return undefined;
  const description = resolveStaticStringLiteral(init.arguments[0]);
  return description || bindingName;
}

/** Type keywords that mean the same in any file. */
const PORTABLE_TYPE_KEYWORDS = new Set([
  "any",
  "bigint",
  "boolean",
  "false",
  "never",
  "null",
  "number",
  "object",
  "readonly",
  "string",
  "symbol",
  "true",
  "undefined",
  "unknown",
  "void",
]);
const TYPE_STRING_LITERAL_REGEX = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
/** An identifier in type text that isn't an object type's property key. */
const TYPE_NAME_REGEX = /(?<![\w$.])[A-Za-z_$][\w$]*(?![\w$]|\s*\??:)/g;

/**
 * A `const`'s declared type (TypeScript annotation first, then JSDoc
 * `@type`), when it only uses literals and type keywords. A type naming
 * anything else (`Size`, `import("./t").Size`) would be out of scope in
 * the component's `.d.ts`.
 */
function portableDeclaredType(
  annotation: string | undefined,
  rawJsDoc: string | undefined,
): InternalExport["declaredType"] {
  const jsDocType = rawJsDoc ? getParserStack().getCommentTags(parseComments(rawJsDoc)).type?.type.trim() : undefined;
  const declared = annotation
    ? { type: annotation, source: "typescript" as const }
    : jsDocType
      ? { type: jsDocType, source: "jsdoc" as const }
      : undefined;
  if (!declared || declared.type.includes("`")) return undefined;
  const names = declared.type.replace(TYPE_STRING_LITERAL_REGEX, '""').match(TYPE_NAME_REGEX) ?? [];
  return names.every((name) => PORTABLE_TYPE_KEYWORDS.has(name)) ? declared : undefined;
}

/**
 * Literal-only return inference for a function/arrow (same idea as
 * `inferReturnTypeFromNode` in props.ts). string/number/boolean/template only.
 */
function inferAstLiteralReturnType(fn: FunctionLike): string | undefined {
  if (fn.async || fn.generator || fn.type === "TSDeclareFunction") return undefined;

  const body = fn.body;
  const returnArgs: Array<Expression | null> = [];
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

function collectAstReturnArguments(body: BlockStatement, out: Array<Expression | null>): void {
  for (const statement of body.body) collectStatementReturnArguments(statement, out);
}

/**
 * A statement's `return` arguments, without entering nested functions. A
 * `return` can only sit in a statement, so following every statement that
 * holds others finds them all.
 */
function collectStatementReturnArguments(statement: Statement, out: Array<Expression | null>): void {
  switch (statement.type) {
    case "ReturnStatement":
      out.push(statement.argument ?? null);
      return;
    case "BlockStatement":
      collectAstReturnArguments(statement, out);
      return;
    case "IfStatement":
      collectStatementReturnArguments(statement.consequent, out);
      if (statement.alternate) collectStatementReturnArguments(statement.alternate, out);
      return;
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
    case "LabeledStatement":
    case "WithStatement":
      collectStatementReturnArguments(statement.body, out);
      return;
    case "TryStatement":
      collectAstReturnArguments(statement.block, out);
      if (statement.handler) collectAstReturnArguments(statement.handler.body, out);
      if (statement.finalizer) collectAstReturnArguments(statement.finalizer, out);
      return;
    case "SwitchStatement":
      for (const switchCase of statement.cases) {
        for (const consequent of switchCase.consequent) collectStatementReturnArguments(consequent, out);
      }
      return;
  }
}

/** A `TSEnumMember`'s literal initializer value, or `undefined` for anything not a plain string/number literal. */
function enumMemberLiteralValue(member: TSEnumMember): string | number | undefined {
  const initializer = member.initializer;
  if (!initializer) return undefined;

  if (initializer.type === "Literal") {
    const value = initializer.value;
    return typeof value === "string" || typeof value === "number" ? value : undefined;
  }

  // Negative numeric literals parse as `UnaryExpression` (`-1`), not `Literal`.
  if (initializer.type === "UnaryExpression" && initializer.operator === "-") {
    const argument = initializer.argument;
    if (argument.type === "Literal" && typeof argument.value === "number") return -argument.value;
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
function enumMemberUnionType(declaration: TSEnumDeclaration): string | undefined {
  const members = declaration.members;
  if (members.length === 0) return undefined;

  const literals: string[] = [];
  let nextNumeric = 0;
  for (const member of members) {
    if (!member.initializer) {
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

/**
 * The entries a declaration contributes, with JSDoc read from before
 * `jsdocStart`. `anonymousName` names a function or class declared without
 * one (`export default class {}`).
 */
function describeDeclaration(
  source: ModuleSource,
  declaration: DeclarationLike,
  jsdocStart: number,
  anonymousName?: string,
): InternalExport[] {
  const declFile = source.filePath;
  const rawJsDoc = leadingJsDocBlock(source.text, jsdocStart);
  const description = rawJsDoc ? jsDocDescription(rawJsDoc) : undefined;
  const jsDocReturnType = rawJsDoc ? getParserStack().extractJsDocReturnType(rawJsDoc) : undefined;
  const { deprecated, tags, internal } = rawJsDoc
    ? getParserStack().extractJsDocDeprecatedAndTags(rawJsDoc)
    : { deprecated: undefined, tags: undefined, internal: false };
  const internalField = internal ? ({ internal: true } as const) : {};

  if (declaration.type === "VariableDeclaration") {
    // `using` can't be exported; anything but `let`/`var` reads as `const`.
    const kind = declaration.kind === "let" || declaration.kind === "var" ? declaration.kind : "const";
    const results: InternalExport[] = [];

    for (const declarator of declaration.declarations) {
      const id = declarator.id;
      const name = identifierName(id);
      if (!name) continue;

      const annotation = annotationText(source, id);
      let type = annotation;
      let value: string | undefined;
      let returnType: string | undefined;
      let literalValue: string | undefined;
      let primitiveLiteral: PrimitiveLiteral | undefined;
      let declaredType: InternalExport["declaredType"];
      let functionNode: ExportedFunction | undefined;
      const init = declarator.init;

      if (init) {
        if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
          functionNode = init;
          if (!type) type = buildSignature(source, init);
          returnType =
            functionReturnAnnotationText(source, init) ??
            jsDocReturnType ??
            returnTypeOfFunctionType(type) ??
            inferAstLiteralReturnType(init);
        } else {
          value = textOf(source, init);
          if (!type) type = inferLiteralType(init);
          // `"k" as const` and `"k" satisfies string` hold the same value as `"k"`.
          const inner = unwrapTypeCastExpression(init);
          literalValue = resolveStaticStringLiteral(inner) ?? symbolKeyDescription(inner, name);
          if (kind === "const") {
            primitiveLiteral = primitiveLiteralOf(source, inner);
            declaredType = portableDeclaredType(annotation, rawJsDoc);
          }
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
        declaredType,
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
    const name = identifierName(declaration.id) ?? anonymousName;
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
    const className = identifierName(declaration.id);
    const name = className ?? anonymousName;
    if (!name) return [];
    return [
      {
        name,
        kind: "class",
        ...(className ? { type: className } : {}),
        description,
        deprecated,
        tags,
        ...internalField,
        declFile,
        isTypeOnly: false,
      },
    ];
  }

  if (declaration.type === "TSTypeAliasDeclaration") {
    const name = identifierName(declaration.id);
    if (!name) return [];
    return [
      {
        name,
        kind: "type",
        type: textOf(source, declaration.typeAnnotation),
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
    const name = identifierName(declaration.id);
    if (!name) return [];
    return [
      {
        name,
        kind: "interface",
        type: textOf(source, declaration.body),
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
    const name = identifierName(declaration.id);
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
 * The entry a module's `export default` contributes, named `default`: a
 * function or class declared in place (with its JSDoc), a function
 * expression, or the local binding it names (`export default helper`).
 */
function describeDefaultExport(
  source: ModuleSource,
  node: ExportDefaultDeclaration,
  resolveLocal: (name: string) => InternalExport | null,
): InternalExport | undefined {
  const declaration = node.declaration;

  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "TSDeclareFunction" ||
    declaration.type === "ClassDeclaration"
  ) {
    const [described] = describeDeclaration(source, declaration, node.start, "default");
    return described ? { ...described, name: "default" } : undefined;
  }

  if (declaration.type === "FunctionExpression" || declaration.type === "ArrowFunctionExpression") {
    return {
      name: "default",
      kind: "function",
      type: buildSignature(source, declaration),
      functionNode: declaration,
      declFile: source.filePath,
      isTypeOnly: false,
    };
  }

  const localName = identifierName(declaration);
  const resolved = localName ? resolveLocal(localName) : null;
  return resolved ? { ...resolved, name: "default" } : undefined;
}

/**
 * The import that binds `name`: `importedName` is the export it reads,
 * `default` for a default import, or `*` for a namespace import.
 */
function findImportSource(
  body: Program["body"],
  name: string,
): { specifier: string; importedName: string; isTypeOnly: boolean } | null {
  for (const node of body) {
    if (node.type !== "ImportDeclaration") continue;
    const specifierValue = node.source.value;

    for (const specifier of node.specifiers) {
      if (specifier.local.name !== name) continue;
      const isTypeOnly =
        node.importKind === "type" || (specifier.type === "ImportSpecifier" && specifier.importKind === "type");
      if (specifier.type === "ImportDefaultSpecifier") {
        return { specifier: specifierValue, importedName: "default", isTypeOnly };
      }
      if (specifier.type === "ImportNamespaceSpecifier") {
        return { specifier: specifierValue, importedName: "*", isTypeOnly };
      }
      if (specifier.type === "ImportSpecifier") {
        const importedName = identifierName(specifier.imported) ?? name;
        return { specifier: specifierValue, importedName, isTypeOnly };
      }
    }
  }

  return null;
}

/** The entry for the namespace object of `namespaceFile`, exported as `name`. */
function namespaceExport(name: string, namespaceFile: string, isTypeOnly: boolean): InternalExport {
  return { name, kind: "const", declFile: namespaceFile, namespaceFile, isTypeOnly };
}

/**
 * Collects every named export declared or re-exported by a module.
 *
 * Walks `export ... from` and `export *` chains. Skips `.svelte` re-exports.
 * A default export that's a function, a class, or a local binding is listed as
 * `default` (see {@link describeDefaultExport}). A namespace export
 * (`export * as ns from "./x"`) is the one entry `ns`, with `namespaceFile`
 * set; the names `x` exports aren't this module's.
 */
export function collectModuleExports(filePath: string, ctx: ResolveContext): InternalExport[] {
  const cached = ctx.cache.get(filePath);
  if (cached) return cached;
  // A module currently being resolved is part of an import cycle.
  if (ctx.computing.has(filePath)) return [];
  ctx.computing.add(filePath);

  const parsed = ctx.graph.parse(filePath);
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
    const declaration = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (!declaration) continue;
    for (const described of describeDeclaration(source, declaration, declaration.start)) {
      localDeclarations.set(described.name, described);
    }
  }

  /**
   * A component a module re-exports (`export { default as X } from "./X.svelte"`).
   * Recorded so a barrel that re-exports it again knows it's a component,
   * which the entry docs leave out, rather than an unknown `const`.
   */
  const componentExport = (name: string, specifier: string): InternalExport => ({
    name,
    kind: "const",
    declFile: resolve(source.dir, specifier),
    isTypeOnly: false,
  });

  /** Resolves a name within `filePath`, following one level of import. */
  const resolveLocal = (name: string): InternalExport | null => {
    const local = localDeclarations.get(name);
    if (local) return local;

    const imported = findImportSource(body, name);
    if (!imported) return null;
    if (imported.specifier.endsWith(".svelte")) return componentExport(name, imported.specifier);

    const target = ctx.graph.resolve(imported.specifier, source.dir);
    if (!target) return null;

    if (imported.importedName === "*") return namespaceExport(name, target, imported.isTypeOnly);
    return findModuleExport(target, imported.importedName, ctx) ?? null;
  };

  /** Entries each `export *` brings in, by name; merged after the explicit exports below. */
  const starExports = new Map<string, InternalExport[]>();

  for (const node of body) {
    if (node.type === "ExportAllDeclaration") {
      const specifierValue = node.source.value;
      if (specifierValue.endsWith(".svelte")) continue;
      const target = ctx.graph.resolve(specifierValue, source.dir);
      if (!target) continue;
      const isTypeOnly = node.exportKind === "type";
      // `export * as ns from "./x"` exports the one name `ns`, like an explicit export.
      const namespaceName = identifierName(node.exported);
      if (namespaceName) {
        results.push(namespaceExport(namespaceName, target, isTypeOnly));
        continue;
      }
      for (const entry of collectModuleExports(target, ctx)) {
        const entries = starExports.get(entry.name) ?? [];
        entries.push(isTypeOnly ? { ...entry, isTypeOnly: true } : entry);
        starExports.set(entry.name, entries);
      }
      continue;
    }

    if (node.type === "ExportDefaultDeclaration") {
      const defaultExport = describeDefaultExport(source, node, resolveLocal);
      if (defaultExport) results.push(defaultExport);
      continue;
    }

    if (node.type !== "ExportNamedDeclaration") continue;

    // Inline `export const/function/class/type/interface/enum`.
    const declaration = node.declaration;
    if (declaration) {
      results.push(...describeDeclaration(source, declaration, node.start));
      continue;
    }

    const moduleSpecifier = node.source?.value;
    if (moduleSpecifier?.endsWith(".svelte")) {
      for (const specifier of node.specifiers) {
        const exportedName = identifierName(specifier.exported);
        if (exportedName) results.push(componentExport(exportedName, moduleSpecifier));
      }
      continue;
    }

    const stmtIsTypeOnly = node.exportKind === "type";

    for (const specifier of node.specifiers) {
      const exportedName = identifierName(specifier.exported);
      const localName = identifierName(specifier.local);
      if (!exportedName || !localName) continue;

      const elementIsTypeOnly = stmtIsTypeOnly || specifier.exportKind === "type";

      let resolved: InternalExport | null = null;
      if (moduleSpecifier) {
        const target = ctx.graph.resolve(moduleSpecifier, source.dir);
        if (target) {
          resolved = findModuleExport(target, localName, ctx) ?? null;
        }
      } else {
        resolved = resolveLocal(localName);
      }

      if (resolved) {
        results.push({ ...resolved, name: exportedName, isTypeOnly: resolved.isTypeOnly || elementIsTypeOnly });
      } else if (localName !== "default") {
        // A default export sveld doesn't read (an object literal, a class, a
        // component behind a nested barrel) isn't listed as a `const`.
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
  // Entries from one file are one declaration (or its overloads). A star
  // never re-exports `default`.
  const explicitNames = new Set(results.map((entry) => entry.name));
  for (const [name, entries] of starExports) {
    if (explicitNames.has(name) || name === "default") continue;
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
 * The entry for `name` among `filePath`'s exports, or `undefined`.
 *
 * `findLast`, not `find`: overloaded declarations (`export function f(...): A;` /
 * `export function f(...): B;` / `export function f(...) { ... }`) all describe
 * to the same name, in source order, with the implementation last. Any other
 * name appears at most once (see {@link collectModuleExports}).
 */
export function findModuleExport(filePath: string, name: string, ctx: ResolveContext): InternalExport | undefined {
  return collectModuleExports(filePath, ctx).findLast((entry) => entry.name === name);
}

/**
 * The export an import of `filePath` reads: `importedName`, then each of
 * `members` through the namespace export before it (`members: ["helper"]`
 * for `ns.helper`, with `export * as ns from "./x"`).
 */
export function findImportedExport(
  filePath: string,
  { importedName, members = [] }: { importedName: string; members?: readonly string[] },
  ctx: ResolveContext,
): InternalExport | undefined {
  let match = findModuleExport(filePath, importedName, ctx);
  for (const member of members) {
    if (match?.namespaceFile === undefined) return undefined;
    match = findModuleExport(match.namespaceFile, member, ctx);
  }
  return match;
}
