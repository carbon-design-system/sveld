import type { AST } from "sveast";
import { walk } from "sveast/walk";

/**
 * Value-level TS wrappers that change a node's `.type` but not its runtime
 * meaning. Svelte's `compile()` strips them (`remove_typescript_nodes`) but
 * `parse()` doesn't, and code like `classifyDefaultValue` expects the
 * unwrapped node. Type declarations and annotations are deliberately kept.
 */
const TYPE_CAST_WRAPPER_TYPES = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** `x as const` or `<const>x`. */
function isConstAssertion(node: AST.SvelteNode): boolean {
  if (node.type !== "TSAsExpression" && node.type !== "TSTypeAssertion") return false;
  const annotation = "typeAnnotation" in node ? node.typeAnnotation : undefined;
  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "const"
  );
}

/**
 * Returning the replacement from `enter` makes `walk` write it to the parent
 * and enter it next, so `a as B as C` unwraps one layer per call down to `a`.
 * The expression under an `as const` goes into `constAssertions`, since its
 * type is no longer the widened one once the wrapper is gone.
 */
export function stripTypeCastWrappers(root: AST.SvelteNode | undefined, constAssertions: WeakSet<object>): void {
  if (!root) return;
  walk(root, {
    enter(node) {
      if (TYPE_CAST_WRAPPER_TYPES.has(node.type) && "expression" in node && node.expression) {
        if (isConstAssertion(node) && typeof node.expression === "object") constAssertions.add(node.expression);
        return node.expression;
      }
    },
  });
}
