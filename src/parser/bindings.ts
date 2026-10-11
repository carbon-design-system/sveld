import type { MemberExpression } from "sveast";
import { splitTopLevel } from "../type-text";
import type { ParserContext } from "./context";
import { getPropTypeByLocalOrPublic } from "./context";
import { findVariableTypeAndDescription } from "./variable-jsdoc";

const WORD_CHAR_REGEX = /\w/;

function extractPropertyType(typeStr: string, propName: string): string | undefined {
  const trimmed = typeStr.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return undefined;

  const segments = splitTopLevel(trimmed.slice(1, -1), ";,").map((segment) => segment.trim());

  for (const segment of segments) {
    if (!segment.startsWith(propName)) continue;
    const afterName = segment.slice(propName.length);
    // `propName` is only a prefix of this member's name.
    if (WORD_CHAR_REGEX.test(afterName.charAt(0))) continue;
    let rest = afterName.trimStart();
    if (rest.startsWith("?")) rest = rest.slice(1).trimStart();
    if (rest.startsWith(":")) return rest.slice(1).trim();
  }

  return undefined;
}

export function resolveMemberExpressionType(ctx: ParserContext, expr: MemberExpression): string | undefined {
  if (expr.computed || expr.object.type !== "Identifier" || expr.property.type !== "Identifier") return undefined;

  const objName = expr.object.name;
  const propName = expr.property.name;

  if (ctx.wholePropsLocals.has(objName)) {
    return getPropTypeByLocalOrPublic(ctx, propName);
  }

  const objType = getPropTypeByLocalOrPublic(ctx, objName) ?? findVariableTypeAndDescription(ctx, objName)?.type;
  if (!objType) return undefined;

  return extractPropertyType(objType, propName);
}
