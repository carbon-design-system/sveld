import type { BlockStatement, Expression } from "svelte-ast";
import { SKIP, walk } from "svelte-ast/walk";

// invariant: nothing under these is value-level (no calls,
// declarations, assignments, or scopes).
export function isTypeOnlySubtree(type: string): boolean {
  return (
    type === "TSTypeAnnotation" ||
    type === "TSTypeAliasDeclaration" ||
    type === "TSInterfaceDeclaration" ||
    type === "TSTypeParameterDeclaration" ||
    type === "TSTypeParameterInstantiation"
  );
}

// A guard for the nodes whose `type` is one of `types`, so a `switch` on
// the narrowed node must handle each of them, and only them, when the
// full node union is too wide to list.
export function nodeTypeGuard<const T extends string>(types: readonly T[]) {
  const typeSet: ReadonlySet<string> = new Set(types);
  return <N extends { type: string }>(node: N): node is Extract<N, { type: T }> => typeSet.has(node.type);
}

// `null` for a bare `return;`. Nested functions have their own
// returns, so the walk doesn't enter them.
export function collectReturnArguments(body: BlockStatement): Array<Expression | null> {
  const returnArgs: Array<Expression | null> = [];
  walk(body, {
    enter(node) {
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        return SKIP;
      }
      if (node.type === "ReturnStatement") returnArgs.push(node.argument ?? null);
    },
  });
  return returnArgs;
}
