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
