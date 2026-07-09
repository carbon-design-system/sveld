import type {
  ArrowFunctionExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  VariableDeclaration,
} from "estree";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isVariableDeclaration(node: unknown): node is VariableDeclaration {
  return isObject(node) && node.type === "VariableDeclaration" && Array.isArray(node.declarations);
}

export function isLiteral(node: unknown): node is Literal {
  return isObject(node) && node.type === "Literal";
}

export function isIdentifier(node: unknown): node is Identifier {
  return isObject(node) && node.type === "Identifier" && typeof node.name === "string";
}

export function isMemberExpression(node: unknown): node is MemberExpression {
  return isObject(node) && node.type === "MemberExpression";
}

export function isObjectExpression(node: unknown): node is ObjectExpression {
  return isObject(node) && node.type === "ObjectExpression" && Array.isArray(node.properties);
}

export function isCallExpression(node: unknown): node is CallExpression {
  return isObject(node) && node.type === "CallExpression";
}

export function isCallExpressionNamed(node: unknown, calleeName: string): node is CallExpression {
  if (!isCallExpression(node)) {
    return false;
  }

  return !!node.callee && isObject(node.callee) && node.callee.type === "Identifier" && node.callee.name === calleeName;
}

/** Unwraps `expr as Type` / `expr satisfies Type`, returning the innermost expression. */
export function unwrapTypeCastExpression(node: unknown): unknown {
  if (
    isObject(node) &&
    (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") &&
    "expression" in node
  ) {
    return unwrapTypeCastExpression(node.expression);
  }

  return node;
}

/** The type node from `expr as Type` / `expr satisfies Type`, if `node` is such a cast. */
export function getTypeCastAnnotation(node: unknown): unknown {
  if (
    isObject(node) &&
    (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") &&
    "typeAnnotation" in node
  ) {
    return node.typeAnnotation;
  }

  return undefined;
}

export function isNewExpression(node: unknown): node is NewExpression {
  return isObject(node) && node.type === "NewExpression";
}

export function isNewExpressionNamed(node: unknown, calleeName: string): node is NewExpression {
  if (!isNewExpression(node)) {
    return false;
  }

  return !!node.callee && isObject(node.callee) && node.callee.type === "Identifier" && node.callee.name === calleeName;
}

export function isFunctionDeclaration(node: unknown): node is FunctionDeclaration {
  return isObject(node) && node.type === "FunctionDeclaration";
}

export function isFunctionExpression(node: unknown): node is FunctionExpression {
  return isObject(node) && node.type === "FunctionExpression";
}

export function isArrowFunctionExpression(node: unknown): node is ArrowFunctionExpression {
  return isObject(node) && node.type === "ArrowFunctionExpression";
}
