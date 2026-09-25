import type { FunctionDeclaration, Node } from "estree";
import { isIdentifier, isMemberExpression } from "../ast-guards";
import type { ComponentPropReExport } from "../ComponentParser";
import type { ParserContext } from "./context";

/** `ImportDeclaration` fields we read from the Svelte/acorn-typescript AST. */
export interface ImportDeclarationNode {
  type: "ImportDeclaration";
  importKind?: "type" | "value";
  source?: { value?: unknown };
  specifiers?: Array<{
    type: string;
    importKind?: "type" | "value";
    local?: { name?: string };
    imported?: { name?: string; value?: unknown };
  }>;
}

/**
 * Record named value imports by local name for later cross-file call-default
 * resolution. Skips type-only imports; those are not runtime callees.
 */
export function collectValueImportBindings(ctx: ParserContext, node: ImportDeclarationNode): void {
  const source = node.source?.value;
  if (typeof source !== "string" || node.importKind === "type") return;

  for (const specifier of node.specifiers ?? []) {
    if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;

    const localName = specifier.local?.name;
    if (!localName) continue;

    const importedName =
      specifier.imported?.name ??
      (typeof specifier.imported?.value === "string" ? specifier.imported.value : localName);

    ctx.valueImportBindingsByLocalName.set(localName, { localName, importedName, source });
  }
}

/** An export of `source`, and any members read off it. */
type ImportedBinding = { source: string; importedName: string; members?: string[] };

/**
 * The import a callee names: a named import (`helper`), a default import
 * (read as `default`), or a namespace member (`h.helper`). Members past the
 * imported binding (`ns.helper` with `ns` a re-exported namespace) come back
 * as `members`, for the resolver to read through. `roots` are the scripts
 * searched for the default and namespace imports
 * {@link collectValueImportBindings} doesn't record.
 */
export function importedCalleeBinding(
  ctx: ParserContext,
  callee: unknown,
  roots: Array<Node | undefined>,
): ImportedBinding | undefined {
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

  for (const root of roots) {
    for (const statement of (root ? scriptBody(root) : undefined) ?? []) {
      const declaration = statement as ImportDeclarationNode;
      const source = declaration.source?.value;
      if (declaration.type !== "ImportDeclaration" || declaration.importKind === "type" || typeof source !== "string") {
        continue;
      }
      const specifier = declaration.specifiers?.find((candidate) => candidate.local?.name === localName);
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
 * as {@link importedCalleeBinding} reads a callee, searching the component's
 * instance and module scripts. `undefined` for anything else, including a
 * plain identifier.
 */
export function importedMemberBinding(ctx: ParserContext, node: unknown): ImportedBinding | undefined {
  if (!isMemberExpression(node)) return undefined;
  return importedCalleeBinding(ctx, node, [ctx.parsed?.instance, ctx.parsed?.module]);
}

/** Top-level statements of a script root (`Program.body`, or the script's `content.body`). */
export function scriptBody(root: Node): unknown[] | undefined {
  const program = root as unknown as { type?: string; body?: unknown[]; content?: { body?: unknown[] } };
  const body = program.type === "Program" ? program.body : (program.content?.body ?? program.body);
  return Array.isArray(body) ? body : undefined;
}

/**
 * Value imports of a `<script context="module">` by local name, so `export { local }`
 * can be written as `export { imported as local } from "..."`. Unlike
 * {@link collectValueImportBindings}, default and namespace imports count too.
 */
export function collectReExportableImports(root: Node | undefined): Map<string, ComponentPropReExport> {
  const imports = new Map<string, ComponentPropReExport>();
  const body = root ? scriptBody(root) : undefined;
  if (!body) return imports;

  for (const statement of body) {
    const node = statement as ImportDeclarationNode;
    if (node.type !== "ImportDeclaration" || node.importKind === "type") continue;
    const from = node.source?.value;
    if (typeof from !== "string") continue;

    for (const specifier of node.specifiers ?? []) {
      const localName = specifier.local?.name;
      if (!localName || specifier.importKind === "type") continue;
      let imported: string;
      if (specifier.type === "ImportDefaultSpecifier") imported = "default";
      else if (specifier.type === "ImportNamespaceSpecifier") imported = "*";
      else imported = specifier.imported?.name ?? String(specifier.imported?.value ?? localName);
      imports.set(localName, { from, imported });
    }
  }
  return imports;
}

/**
 * Collect imports and function declarations from a script root before prop defaults run.
 * Both hoist, so `export let id = uniqueId()` still resolves when the import or
 * `function uniqueId()` appears later, the pattern carbon-components-svelte uses.
 * The main walk records the same bindings again into keyed maps; that is fine.
 */
export function collectHoistedScriptBindings(ctx: ParserContext, root: Node | undefined): void {
  if (!root) return;

  // Only top-level statements: imports can't appear anywhere else, and a
  // function declared inside a block or another function isn't in scope for
  // a top-level prop default (module code is strict). The main walk still
  // records every nested declaration afterwards. Reading `Program.body`
  // (or the script's `content.body`) skips a full walk of the script AST.
  const body = scriptBody(root);
  if (!body) return;

  for (const statement of body) {
    const node = statement as { type: string; declaration?: { type: string } | null };
    if (node.type === "ImportDeclaration") {
      collectValueImportBindings(ctx, node as unknown as ImportDeclarationNode);
      continue;
    }

    const declaration = node.type === "ExportNamedDeclaration" && node.declaration ? node.declaration : node;
    if (declaration.type === "FunctionDeclaration") {
      const funcDecl = declaration as unknown as FunctionDeclaration;
      if (funcDecl.id?.name) {
        ctx.funcDecls.set(funcDecl.id.name, funcDecl);
      }
    }
  }
}
