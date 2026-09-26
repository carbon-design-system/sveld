import type { ImportDeclaration } from "estree";
import type { AST } from "svelte/compiler";
import { isIdentifier, isMemberExpression } from "../ast-guards";
import type { ComponentPropReExport } from "../model";
import type { ParserContext } from "./context";

/**
 * An `ImportDeclaration` as acorn-typescript parses it: estree's, plus the
 * `importKind` it sets on `import type` and `import { type x }`.
 */
export type ImportDeclarationNode = ImportDeclaration & {
  importKind?: "type" | "value";
  specifiers: Array<ImportDeclaration["specifiers"][number] & { importKind?: "type" | "value" }>;
};

/**
 * Record named value imports by local name for later cross-file call-default
 * resolution. Skips type-only imports; those are not runtime callees.
 */
export function collectValueImportBindings(ctx: ParserContext, node: ImportDeclarationNode): void {
  const source = node.source.value;
  if (typeof source !== "string" || node.importKind === "type") return;

  for (const specifier of node.specifiers) {
    if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;

    const localName = specifier.local.name;
    if (!localName) continue;

    const { imported } = specifier;
    const importedName =
      imported.type === "Identifier" ? imported.name : typeof imported.value === "string" ? imported.value : localName;

    ctx.valueImportBindingsByLocalName.set(localName, { localName, importedName, source });
  }
}

/** An export of `source`, and any members read off it. */
type ImportedBinding = { source: string; importedName: string; members?: string[] };

/** The export an import names, read through namespace exports: `keys.THEME`. */
export function importPath(binding: { importedName: string; members?: string[] }): string {
  return [binding.importedName, ...(binding.members ?? [])].join(".");
}

/**
 * The import a callee names: a named import (`helper`), a default import
 * (read as `default`), or a namespace member (`h.helper`). Members past the
 * imported binding (`ns.helper` with `ns` a re-exported namespace) come back
 * as `members`, for the resolver to read through. Default and namespace
 * imports, which {@link collectValueImportBindings} doesn't record, are
 * found by searching the component's scripts.
 */
export function importedCalleeBinding(ctx: ParserContext, callee: unknown): ImportedBinding | undefined {
  type CalleeNode = { type?: string; computed?: boolean; object?: unknown; property?: unknown };
  // `a.b.c` -> `a`, with members `["b", "c"]`.
  const members: string[] = [];
  let node = callee as CalleeNode;
  while (node.type === "MemberExpression") {
    if (node.computed || !isIdentifier(node.property)) return undefined;
    members.unshift(node.property.name);
    node = node.object as CalleeNode;
  }
  if (!isIdentifier(node)) return undefined;
  const localName = node.name;

  const binding = (source: string, importedName: string, rest: string[]) =>
    rest.length > 0 ? { source, importedName, members: rest } : { source, importedName };

  const named = ctx.valueImportBindingsByLocalName.get(localName);
  if (named) return binding(named.source, named.importedName, members);

  for (const script of [ctx.parsed?.instance, ctx.parsed?.module]) {
    for (const statement of script?.content.body ?? []) {
      if (statement.type !== "ImportDeclaration") continue;
      const declaration: ImportDeclarationNode = statement;
      const source = declaration.source.value;
      if (declaration.importKind === "type" || typeof source !== "string") continue;
      const specifier = declaration.specifiers.find((candidate) => candidate.local.name === localName);
      if (specifier?.type === "ImportDefaultSpecifier") {
        return binding(source, "default", members);
      }
      if (specifier?.type === "ImportNamespaceSpecifier" && members.length > 0) {
        return binding(source, members[0], members.slice(1));
      }
    }
  }
  return undefined;
}

/**
 * The imported value a member expression reads (`keys.THEME`, `C.timing.DELAY`),
 * as {@link importedCalleeBinding} reads a callee. `undefined` for anything
 * else, including a plain identifier.
 */
export function importedMemberBinding(ctx: ParserContext, node: unknown): ImportedBinding | undefined {
  if (!isMemberExpression(node)) return undefined;
  return importedCalleeBinding(ctx, node);
}

/**
 * Value imports of a `<script context="module">` by local name, so `export { local }`
 * can be written as `export { imported as local } from "..."`. Unlike
 * {@link collectValueImportBindings}, default and namespace imports count too.
 */
export function collectReExportableImports(script: AST.Script): Map<string, ComponentPropReExport> {
  const imports = new Map<string, ComponentPropReExport>();

  for (const statement of script.content.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const node: ImportDeclarationNode = statement;
    if (node.importKind === "type") continue;
    const from = node.source.value;
    if (typeof from !== "string") continue;

    for (const specifier of node.specifiers) {
      const localName = specifier.local.name;
      if (!localName || specifier.importKind === "type") continue;
      let imported: string;
      if (specifier.type === "ImportDefaultSpecifier") imported = "default";
      else if (specifier.type === "ImportNamespaceSpecifier") imported = "*";
      else if (specifier.imported.type === "Identifier") imported = specifier.imported.name;
      else imported = String(specifier.imported.value ?? localName);
      imports.set(localName, { from, imported });
    }
  }
  return imports;
}

/**
 * Collect imports and function declarations from a script before prop defaults run.
 * Both hoist, so `export let id = uniqueId()` still resolves when the import or
 * `function uniqueId()` appears later, the pattern carbon-components-svelte uses.
 * The main walk records the same bindings again into keyed maps; that is fine.
 */
export function collectHoistedScriptBindings(ctx: ParserContext, script: AST.Script | undefined): void {
  // Only top-level statements: imports can't appear anywhere else, and a
  // function declared inside a block or another function isn't in scope for
  // a top-level prop default (module code is strict). The main walk still
  // records every nested declaration afterwards. Reading the script's
  // `content.body` skips a full walk of the script AST.
  for (const statement of script?.content.body ?? []) {
    if (statement.type === "ImportDeclaration") {
      collectValueImportBindings(ctx, statement);
      continue;
    }

    const declaration =
      statement.type === "ExportNamedDeclaration" && statement.declaration ? statement.declaration : statement;
    if (declaration.type === "FunctionDeclaration" && declaration.id?.name) {
      ctx.funcDecls.set(declaration.id.name, declaration);
    }
  }
}
