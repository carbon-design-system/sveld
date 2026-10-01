import type {
  CallExpression,
  Expression,
  Identifier,
  Literal,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  Property,
  TypeNode,
  VariableDeclaration,
} from "sveast";

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

function isCallExpression(node: unknown): node is CallExpression {
  return isObject(node) && node.type === "CallExpression";
}

export function isCallExpressionNamed(node: unknown, calleeName: string): node is CallExpression {
  if (!isCallExpression(node)) {
    return false;
  }

  return !!node.callee && isObject(node.callee) && node.callee.type === "Identifier" && node.callee.name === calleeName;
}

export function unwrapTypeCastExpression<T extends Expression | null | undefined>(node: T): T | Expression {
  return node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression"
    ? unwrapTypeCastExpression(node.expression)
    : node;
}

export function getTypeCastAnnotation(node: Expression | null | undefined): TypeNode | undefined {
  return node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression" ? node.typeAnnotation : undefined;
}

function isNewExpression(node: unknown): node is NewExpression {
  return isObject(node) && node.type === "NewExpression";
}

export function isNewExpressionNamed(node: unknown, calleeName: string): node is NewExpression {
  if (!isNewExpression(node)) {
    return false;
  }

  return !!node.callee && isObject(node.callee) && node.callee.type === "Identifier" && node.callee.name === calleeName;
}

/**
 * String value of a `Literal` or a template with no interpolation.
 * `1` becomes `"1"`. Returns `null` for `null` literals, interpolated
 * templates, and anything else.
 */
export function resolveStaticStringLiteral(node: unknown): string | null {
  if (!isObject(node) || typeof node.type !== "string") return null;

  if (node.type === "Literal") {
    const value = (node as { value?: unknown }).value;
    if (typeof value === "string") return value;
    return value == null ? null : String(value);
  }

  if (node.type === "TemplateLiteral") {
    const quasis = (node as { quasis?: Array<{ value?: { cooked?: string | null } }> }).quasis;
    if (quasis?.length === 1) {
      const cooked = quasis[0]?.value?.cooked;
      return cooked == null ? null : cooked;
    }
  }

  return null;
}

/** Name of a non-computed object key: an identifier's name or a literal's value as text. */
export function getPropertyName(node: Property["key"]): string | undefined {
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;
  if (isIdentifier(node)) return node.name;
  if (isLiteral(node)) return node.value == null ? undefined : String(node.value);
  return undefined;
}
