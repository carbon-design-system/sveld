import type { AST, ImportDeclaration, ImportSpecifier } from "svelte-ast";
import { isIdentifier, isMemberExpression } from "../ast-guards";
import type { ComponentPropReExport } from "../model";
import type { ParserContext } from "./context";

export function importSpecifierImportedName({ imported }: ImportSpecifier): string {
  return imported.type === "Identifier" ? imported.name : imported.value;
}

// Named imports only, for cross-file call-default resolution.
export function collectValueImportBindings(ctx: ParserContext, node: ImportDeclaration): void {
  const source = node.source.value;
  if (typeof source !== "string" || node.importKind === "type") return;

  for (const specifier of node.specifiers) {
    if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;

    const localName = specifier.local.name;
    const importedName = importSpecifierImportedName(specifier);
    ctx.valueImportBindingsByLocalName.set(localName, { localName, importedName, source });
  }
}

type ImportedBinding = { source: string; importedName: string; members?: string[] };

export function importPath(binding: { importedName: string; members?: string[] }): string {
  return [binding.importedName, ...(binding.members ?? [])].join(".");
}

// `collectValueImportBindings` doesn't record default and namespace
// imports, so those are found by searching the component's scripts.
// Members past the imported binding come back as `members` for the
// resolver to read through.
export function importedCalleeBinding(ctx: ParserContext, callee: unknown): ImportedBinding | undefined {
  // Only a chain of plain names resolves: `a.b.c` gives `a`, with
  // members `["b", "c"]`.
  const members: string[] = [];
  let node = callee;
  while (isMemberExpression(node)) {
    if (node.computed || !isIdentifier(node.property)) return undefined;
    members.unshift(node.property.name);
    node = node.object;
  }
  if (!isIdentifier(node)) return undefined;
  return importedBindingByName(ctx, node.name, members);
}

export function importedBindingByName(
  ctx: ParserContext,
  localName: string,
  members: string[] = [],
): ImportedBinding | undefined {
  const binding = (source: string, importedName: string, rest: string[]) =>
    rest.length > 0 ? { source, importedName, members: rest } : { source, importedName };

  const named = ctx.valueImportBindingsByLocalName.get(localName);
  if (named) return binding(named.source, named.importedName, members);

  for (const script of [ctx.parsed?.instance, ctx.parsed?.module]) {
    for (const statement of script?.content.body ?? []) {
      if (statement.type !== "ImportDeclaration") continue;
      const source = statement.source.value;
      if (statement.importKind === "type" || typeof source !== "string") continue;
      const specifier = statement.specifiers.find((candidate) => candidate.local.name === localName);
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

// Only a member expression, never a plain identifier.
export function importedMemberBinding(ctx: ParserContext, node: unknown): ImportedBinding | undefined {
  if (!isMemberExpression(node)) return undefined;
  return importedCalleeBinding(ctx, node);
}

// So `export { local }` can be written as
// `export { imported as local } from "..."`, default and namespace
// imports count too, unlike in `collectValueImportBindings`.
export function collectReExportableImports(script: AST.Script): Map<string, ComponentPropReExport> {
  const imports = new Map<string, ComponentPropReExport>();

  for (const statement of script.content.body) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
    const from = statement.source.value;
    if (typeof from !== "string") continue;

    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") continue;
      const localName = specifier.local.name;
      let imported: string;
      if (specifier.type === "ImportDefaultSpecifier") imported = "default";
      else if (specifier.type === "ImportNamespaceSpecifier") imported = "*";
      else imported = importSpecifierImportedName(specifier);
      imports.set(localName, { from, imported });
    }
  }
  return imports;
}

// Imports and function declarations hoist, so collect them before prop
// defaults run: `export let id = uniqueId()` must resolve when
// `uniqueId` is declared later (carbon-components-svelte does this).
export function collectHoistedScriptBindings(ctx: ParserContext, script: AST.Script | undefined): void {
  // Top-level only: a nested function isn't in scope for a top-level prop
  // default (module code is strict).
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
