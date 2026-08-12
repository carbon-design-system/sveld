import type { FunctionDeclaration } from "estree";
import type { Node } from "estree-walker";
import { walk } from "estree-walker";
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
 * Collect imports and function declarations from a script root before prop defaults run.
 * Both hoist, so `export let id = uniqueId()` still resolves when the import or
 * `function uniqueId()` appears later, the pattern carbon-components-svelte uses.
 * The main walk records the same bindings again into keyed maps; that is fine.
 */
export function collectHoistedScriptBindings(ctx: ParserContext, root: Node | undefined): void {
  if (!root) return;

  walk(root, {
    enter(node) {
      if (node.type === "ImportDeclaration") {
        collectValueImportBindings(ctx, node as unknown as ImportDeclarationNode);
      }

      if (node.type === "FunctionDeclaration") {
        const funcDecl = node as unknown as FunctionDeclaration;
        if (funcDecl.id?.name) {
          ctx.funcDecls.set(funcDecl.id.name, funcDecl);
        }
      }
    },
  });
}
