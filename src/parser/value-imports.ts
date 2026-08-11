import type { ParserContext } from "./context";

/** Minimal shape of an `ImportDeclaration` node from the Svelte/acorn-typescript AST. */
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
 * Tracks named *value* imports (`import { x } from "..."`) by local binding
 * name, so a `CallExpression` prop default calling `x()` can later be
 * resolved cross-file (see `resolve-call-defaults.ts`). Type-only imports
 * (`import type { x }` / `import { type x }`) are skipped; they can't be
 * called at runtime, so they never appear as a prop default's callee.
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
