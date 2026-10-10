import type { AST, TSNode } from "sveast";
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

/** What a stripped cast said about the expression under it. */
export interface TypeCasts {
  /** Expressions written with `as const`. */
  constAssertions: WeakSet<object>;
  /** Expressions written with `as T` or `<T>`, and the outermost `T`. */
  typeAssertions: WeakMap<object, TSNode>;
}

/**
 * Returning the replacement from `enter` makes `walk` write it to the parent
 * and enter it next, so `a as B as C` unwraps one layer per call down to `a`.
 * The casts are recorded in `casts`, since the expression's type is the cast
 * type, not its own, once the wrapper is gone. The outermost cast wins, and
 * passes through `!` and `satisfies`, which don't change the type.
 */
export function stripTypeCastWrappers(root: AST.SvelteNode | undefined, casts: TypeCasts): void {
  if (!root) return;
  walk(root, {
    enter(node) {
      if (!TYPE_CAST_WRAPPER_TYPES.has(node.type) || !("expression" in node) || !node.expression) return;
      const { expression } = node;
      if (typeof expression !== "object") return expression;

      const outer = casts.typeAssertions.get(node);
      if (casts.constAssertions.has(node) || (outer === undefined && isConstAssertion(node))) {
        casts.constAssertions.add(expression);
      } else if (outer !== undefined) {
        casts.typeAssertions.set(expression, outer);
      } else if ((node.type === "TSAsExpression" || node.type === "TSTypeAssertion") && "typeAnnotation" in node) {
        casts.typeAssertions.set(expression, node.typeAnnotation as TSNode);
      }
      return expression;
    },
  });
}
