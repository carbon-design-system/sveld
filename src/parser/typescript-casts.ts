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

interface AstNode {
  type: string;
  expression?: AstNode;
  [key: string]: unknown;
}

function isAstNode(value: unknown): value is AstNode {
  return value !== null && typeof value === "object" && typeof (value as AstNode).type === "string";
}

/** The innermost non-wrapper expression under `node`, or `node` itself when it isn't a wrapper (or wraps nothing). */
function unwrap(node: AstNode): AstNode {
  if (!TYPE_CAST_WRAPPER_TYPES.has(node.type)) return node;
  let inner = node.expression;
  while (inner && TYPE_CAST_WRAPPER_TYPES.has(inner.type)) inner = inner.expression;
  return inner ?? node;
}

export function stripTypeCastWrappers(root: unknown): void {
  if (!isAstNode(root)) return;
  stripChildren(root);
}

/**
 * Replaces each wrapper child in place with its unwrapped expression, then
 * keeps walking inside the replacement. Same traversal and replacement
 * semantics as the estree-walker `enter` + `replace` this used to run, on a
 * plain recursive walk with no visitor context.
 */
function stripChildren(node: AstNode): void {
  // `for...in` on acorn/svelte nodes: plain objects, no enumerable prototype keys.
  for (const key in node) {
    if (key === "leadingComments") continue;
    const value = node[key];
    if (!value || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!isAstNode(item)) continue;
        const replacement = unwrap(item);
        if (replacement !== item) value[i] = replacement;
        stripChildren(replacement);
      }
    } else if (isAstNode(value)) {
      const replacement = unwrap(value);
      if (replacement !== value) node[key] = replacement;
      stripChildren(replacement);
    }
  }
}
