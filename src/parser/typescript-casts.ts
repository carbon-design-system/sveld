import type { Node } from "estree-walker";
import { walk } from "estree-walker";

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

export function stripTypeCastWrappers(root: unknown): void {
  if (!root || typeof root !== "object") return;

  walk(root as Node, {
    enter(node) {
      if (!TYPE_CAST_WRAPPER_TYPES.has(node.type)) return;

      let inner = (node as { expression?: Node }).expression;
      while (inner && TYPE_CAST_WRAPPER_TYPES.has(inner.type)) {
        inner = (inner as { expression?: Node }).expression;
      }
      if (inner) this.replace(inner);
    },
  });
}
