import type { AST } from "sveast";
import { walk } from "sveast/walk";

/**
 * Value-level TS wrapper expressions that change a node's own `.type` without changing its
 * runtime meaning. `compile()` strips these (via `remove_typescript_nodes`) before exposing its
 * AST, so code built against `compiled.ast` - e.g. `classifyDefaultValue` in `parser/props.ts` -
 * expects to see the unwrapped literal/array/object/function node directly, never the wrapper.
 * `parse()` alone does not strip them, so calling it directly (see `ComponentParser.ts`) requires
 * replicating this narrow subset of `remove_typescript_nodes` ourselves.
 *
 * Interface/type-alias declarations and type annotations are deliberately left alone: nothing
 * downstream inspects `ctx.parsed` expecting those removed (the parts of sveld that need them
 * gone, or need them present, already work off the separate modern-mode parse in
 * `buildRunesPropTypeMetadata`, which never went through `compile()` either).
 */
const TYPE_CAST_WRAPPER_TYPES = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/**
 * Replaces each wrapper in place with the expression it wraps. Returning the
 * replacement from `enter` makes `walk` write it to the parent and enter it
 * next, so `a as B as C` loses one layer per call, down to `a`.
 */
export function stripTypeCastWrappers(root: AST.SvelteNode | undefined): void {
  if (!root) return;
  walk(root, {
    enter(node) {
      if (TYPE_CAST_WRAPPER_TYPES.has(node.type) && "expression" in node && node.expression) {
        return node.expression;
      }
    },
  });
}
