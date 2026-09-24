import type { FunctionDeclaration, Node } from "estree";
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

/**
 * The imported function a call's callee names, for following a dispatcher
 * into it: a named import (`helper`), a default import (`helper`, read as the
 * module's `default` export), or a namespace member (`h.helper`). `roots` are
 * the component's scripts, searched for the default and namespace imports
 * {@link collectValueImportBindings} doesn't record.
 */
export function importedCalleeBinding(
  ctx: ParserContext,
  callee: unknown,
  roots: Array<Node | undefined>,
): { source: string; importedName: string } | undefined {
  const node = callee as { type?: string; name?: string; computed?: boolean; object?: unknown; property?: unknown };
  const objectName = node.type === "MemberExpression" && !node.computed ? identifierName(node.object) : undefined;
  const propertyName = objectName === undefined ? undefined : identifierName(node.property);
  const localName = node.type === "Identifier" ? node.name : objectName;
  if (!localName) return undefined;

  if (node.type === "Identifier") {
    const named = ctx.valueImportBindingsByLocalName.get(localName);
    if (named) return named;
  }

  for (const root of roots) {
    for (const statement of (root ? scriptBody(root) : undefined) ?? []) {
      const declaration = statement as ImportDeclarationNode;
      const source = declaration.source?.value;
      if (declaration.type !== "ImportDeclaration" || declaration.importKind === "type" || typeof source !== "string") {
        continue;
      }
      const specifier = declaration.specifiers?.find((candidate) => candidate.local?.name === localName);
      if (specifier?.type === "ImportDefaultSpecifier" && node.type === "Identifier") {
        return { source, importedName: "default" };
      }
      if (specifier?.type === "ImportNamespaceSpecifier" && propertyName) {
        return { source, importedName: propertyName };
      }
    }
  }
  return undefined;
}

function identifierName(node: unknown): string | undefined {
  const identifier = node as { type?: string; name?: string } | null | undefined;
  return identifier?.type === "Identifier" ? identifier.name : undefined;
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
