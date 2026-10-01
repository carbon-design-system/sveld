import type { BlockStatement, Expression } from "sveast";
import { SKIP, walk } from "sveast/walk";

/**
 * TS nodes whose entire subtree is type-level: annotations, type aliases,
 * interfaces, and type parameter lists. Nothing under them is a value-level
 * node (no calls, declarations, assignments, or scopes).
 */
export function isTypeOnlySubtree(type: string): boolean {
  return (
    type === "TSTypeAnnotation" ||
    type === "TSTypeAliasDeclaration" ||
    type === "TSInterfaceDeclaration" ||
    type === "TSTypeParameterDeclaration" ||
    type === "TSTypeParameterInstantiation"
  );
}

/**
 * `body`'s own `return` arguments, `null` for a bare `return;`. Nested
 * functions have their own returns, so the walk doesn't enter them.
 */
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
