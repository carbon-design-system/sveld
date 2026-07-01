import type ComponentParser from "../ComponentParser";
import type { ParserContext } from "./context";

/** Matches a single word character; used to reject partial-name matches in {@link extractPropertyType}. */
const WORD_CHAR_REGEX = /\w/;

/** Pull `propName`'s type out of an object type string like `{ value: string; other: number }`. */
export function extractPropertyType(typeStr: string, propName: string): string | undefined {
  const trimmed = typeStr.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return undefined;

  const inner = trimmed.slice(1, -1);
  const segments: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of inner) {
    if (char === "{" || char === "<" || char === "(" || char === "[") {
      depth++;
      current += char;
    } else if (char === "}" || char === ">" || char === ")" || char === "]") {
      depth--;
      current += char;
    } else if ((char === ";" || char === ",") && depth === 0) {
      segments.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) segments.push(current.trim());

  for (const segment of segments) {
    if (!segment.startsWith(propName)) continue;
    const afterName = segment.slice(propName.length);
    if (afterName.length > 0 && WORD_CHAR_REGEX.test(afterName[0])) continue;
    let rest = afterName.trimStart();
    if (rest.startsWith("?")) rest = rest.slice(1).trimStart();
    if (rest.startsWith(":")) {
      return rest.slice(1).trim();
    }
  }

  return undefined;
}

/** Resolve `obj.prop` by looking up `obj`'s type and calling {@link extractPropertyType}. */
export function resolveMemberExpressionType(
  ctx: ParserContext,
  parser: ComponentParser,
  expr: unknown,
): string | undefined {
  const memberExpr = expr as {
    object?: { type?: string; name?: string };
    property?: { type?: string; name?: string };
    computed?: boolean;
  };

  if (memberExpr.computed || memberExpr.object?.type !== "Identifier" || memberExpr.property?.type !== "Identifier") {
    return undefined;
  }

  const objName = memberExpr.object.name;
  const propName = memberExpr.property.name;
  if (!objName || !propName) return undefined;

  if (ctx.wholePropsLocals.has(objName)) {
    return parser.getPropTypeByLocalOrPublic(propName);
  }

  const objType = parser.getPropTypeByLocalOrPublic(objName) ?? parser.findVariableTypeAndDescription(objName)?.type;
  if (!objType) return undefined;

  return extractPropertyType(objType, propName);
}
