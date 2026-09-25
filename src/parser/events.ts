import type { ArrayExpression, CallExpression, ObjectExpression, Property } from "estree";
import { isIdentifier, isLiteral, isNewExpressionNamed, isObjectExpression } from "../ast-guards";
import type ComponentParser from "../ComponentParser";
import type { DispatchedEvent, SerializedComponentEvent } from "../ComponentParser";
import type { ParserContext } from "./context";
import { literalValueType } from "./props";
import { sourceRangeFromNode } from "./source-position";
import { assignValueOrUndefined, compareText, escapeCommentText } from "./utils";

const NEWLINES_REGEX = /\n/g;
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

/**
 * What {@link deriveLiteralDetailType} reads identifier types and property
 * names through: the component's parser, or a stand-in for a module sveld
 * reads without one (an imported dispatch helper).
 */
export type DetailTypeSource = Pick<ComponentParser, "findVariableTypeAndDescription" | "getPropertyName">;

/**
 * Structurally infers a dispatched event's detail type from an object or array literal `dispatch()`
 * argument (`{ id: string }`, `number[]`), resolving identifier property values through the
 * existing variable-type lookup and falling back to `any` per property/element rather than for the
 * whole detail. Returns `undefined` for anything else so callers keep their own scalar-literal
 * narrowing (`dispatch("count", 5)` still types as `5`).
 */
export function deriveLiteralDetailType(parser: DetailTypeSource, node: unknown): string | undefined {
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;
  if (isObjectExpression(node)) return buildObjectLiteralDetailType(parser, node);
  if (node.type === "ArrayExpression") return buildArrayLiteralDetailType(parser, node as ArrayExpression);
  return undefined;
}

function inferLiteralMemberType(parser: DetailTypeSource, node: unknown): string {
  if (!node || typeof node !== "object" || !("type" in node)) return "any";
  if (isIdentifier(node)) return parser.findVariableTypeAndDescription(node.name)?.type ?? "any";

  if (isLiteral(node)) return literalValueType(node) ?? "null";

  if (isObjectExpression(node)) return buildObjectLiteralDetailType(parser, node);
  if (node.type === "ArrayExpression") return buildArrayLiteralDetailType(parser, node as ArrayExpression);

  return "any";
}

/**
 * `{}` types as `Record<string, never>` (never `null`, and not the banned bare `{}`). A spread or
 * computed key adds members sveld can't name, so it becomes a `[key: string]: any` index
 * signature alongside the known members, or `Record<string, any>` when there are none.
 */
function buildObjectLiteralDetailType(parser: DetailTypeSource, node: ObjectExpression): string {
  if (node.properties.length === 0) return "Record<string, never>";

  const properties: Array<{ name: string; type: string }> = [];
  let hasUnknownMembers = false;
  for (const property of node.properties) {
    const name =
      property.type === "Property" && !property.computed
        ? parser.getPropertyName(property.key as Property["key"])
        : undefined;
    if (property.type !== "Property" || !name) {
      hasUnknownMembers = true;
      continue;
    }
    properties.push({ name, type: inferLiteralMemberType(parser, property.value) });
  }

  if (!hasUnknownMembers) return buildEventDetailFromProperties(properties);
  if (properties.length === 0) return "Record<string, any>";
  return buildEventDetailFromProperties([...properties, { name: "[key: string]", type: "any" }]);
}

function buildArrayLiteralDetailType(parser: DetailTypeSource, node: ArrayExpression): string {
  const elementTypes = new Set(
    node.elements.filter((element) => element != null).map((element) => inferLiteralMemberType(parser, element)),
  );
  if (elementTypes.size === 0) return "any[]";
  if (elementTypes.size === 1) return `${[...elementTypes][0]}[]`;
  return `(${[...elementTypes].join(" | ")})[]`;
}

/**
 * Where `call` hands the dispatcher itself to another function: as an argument
 * (`helper(dispatch)`) or an object literal property (`helper({ dispatch })`).
 * Events dispatched in there are out of the component's own script.
 */
export function findDispatcherArgument(
  call: CallExpression,
  dispatcherName: string,
): { argumentIndex: number; property?: string } | undefined {
  for (const [argumentIndex, argument] of call.arguments.entries()) {
    if (isIdentifier(argument) && argument.name === dispatcherName) return { argumentIndex };
    if (!isObjectExpression(argument)) continue;
    for (const property of argument.properties) {
      if (property.type !== "Property" || !isIdentifier(property.value)) continue;
      if (property.value.name !== dispatcherName) continue;
      // A computed key can't be matched to the helper's parameter, so it stays unnamed.
      const key = !property.computed && isIdentifier(property.key) ? property.key.name : undefined;
      return { argumentIndex, property: key ?? "" };
    }
  }
  return undefined;
}

/** Event order in every output: by name, then dispatched before forwarded, then by element and detail. */
export function compareSerializedEvents(a: SerializedComponentEvent, b: SerializedComponentEvent): number {
  const nameCompare = compareText(a.name, b.name);
  if (nameCompare !== 0) return nameCompare;

  const typeCompare = compareText(a.type, b.type);
  if (typeCompare !== 0) return typeCompare;

  if (a.type === "forwarded" && b.type === "forwarded") {
    const elementCompare = compareText(a.element, b.element);
    if (elementCompare !== 0) return elementCompare;
  }

  return compareText(a.detail ?? "", b.detail ?? "");
}

export function literalDetailToTypeText(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** Merge or add a dispatched event. Detail defaults to `null` when the dispatch has no argument and no `@event` detail. */
export function addDispatchedEvent(
  ctx: ParserContext,
  {
    name,
    detail,
    has_argument,
    description,
    deprecated,
    tags,
    internal,
    source,
  }: Pick<DispatchedEvent, "name" | "description" | "deprecated" | "tags" | "internal" | "source"> & {
    detail: string;
    has_argument: boolean;
  },
) {
  if (name === undefined) return;

  const default_detail = !has_argument && !detail ? "null" : assignValueOrUndefined(detail);
  const event_description = description;
  const existing_event = ctx.events.get(name);
  if (existing_event?.type === "forwarded") {
    /**
     * A dispatched event always takes precedence over a forwarded event of the same
     * name, regardless of which was detected first during the walk (forwarding is
     * recorded as soon as the template is visited, while createEventDispatcher()
     * dispatches are only resolved after the whole walk completes). Non-conflicting
     * metadata from the forwarded event is preserved as a fallback.
     */
    ctx.events.set(name, {
      type: "dispatched",
      name,
      detail: default_detail,
      description: event_description || existing_event.description,
      deprecated: deprecated ?? existing_event.deprecated,
      tags: tags ?? existing_event.tags,
      ...(internal || existing_event.internal ? { internal: true as const } : {}),
      source: source || existing_event.source,
    });
  } else if (existing_event) {
    const merged_tags = existing_event.tags ?? tags;
    // An untyped `@event`'s `null` detail is only a fallback: the first dispatch replaces it.
    const replacesUntypedDetail = ctx.untypedJsDocEventNames.delete(name);
    ctx.events.set(name, {
      ...existing_event,
      detail: existing_event.detail === undefined || replacesUntypedDetail ? default_detail : existing_event.detail,
      description: existing_event.description || event_description,
      deprecated: existing_event.deprecated ?? deprecated,
      tags: merged_tags,
      ...(existing_event.internal || internal ? { internal: true as const } : {}),
      source: source || existing_event.source,
    });
  } else {
    ctx.events.set(name, {
      type: "dispatched",
      name,
      detail: default_detail,
      description: event_description,
      deprecated,
      tags,
      ...(internal ? { internal: true as const } : {}),
      source,
    });
  }
}

/**
 * Detect `$host().dispatchEvent(new CustomEvent("name", { detail }))` (or `new Event(...)`) and
 * record it as a dispatched event, mirroring `createEventDispatcher()` detection.
 */
export function parseHostDispatchEventCall(ctx: ParserContext, dispatchEventCall: CallExpression): string | undefined {
  const eventArg = dispatchEventCall.arguments[0];
  const isCustomEvent = isNewExpressionNamed(eventArg, "CustomEvent");
  if (!isCustomEvent && !isNewExpressionNamed(eventArg, "Event")) return undefined;

  const nameArg = eventArg.arguments[0];
  const eventName = isLiteral(nameArg) ? nameArg.value : undefined;
  if (eventName == null) return undefined;

  const optionsArg = isCustomEvent ? eventArg.arguments[1] : undefined;
  let hasArgument = false;
  let detailValue: unknown;
  if (isObjectExpression(optionsArg)) {
    const detailProperty = optionsArg.properties.find(
      (property) => property.type === "Property" && isIdentifier(property.key) && property.key.name === "detail",
    );
    if (detailProperty?.type === "Property") {
      hasArgument = true;
      detailValue = isLiteral(detailProperty.value) ? detailProperty.value.value : undefined;
    }
  }

  addDispatchedEvent(ctx, {
    name: String(eventName),
    detail: detailValue == null ? "" : literalDetailToTypeText(detailValue),
    has_argument: hasArgument,
    source: sourceRangeFromNode(ctx, dispatchEventCall),
  });

  return String(eventName);
}

export function buildEventDetailFromProperties(
  properties: Array<{ name: string; type: string; description?: string; optional?: boolean; default?: string }>,
  _eventName?: string,
  multiline = false,
): string {
  if (properties.length === 0) return "null";

  const props = properties
    .map(({ name, type, description, optional, default: defaultValue }) => {
      const optionalMarker = optional ? "?" : "";
      // `"a-b"` needs its quotes back; `[key: string]` is an index signature, not a key.
      const key = IDENTIFIER_REGEX.test(name) || name.startsWith("[") ? name : JSON.stringify(name);
      let comment = description || "";

      if (defaultValue && comment) {
        comment = `${comment} @default ${defaultValue}`;
      } else if (defaultValue) {
        comment = `@default ${defaultValue}`;
      }
      comment = escapeCommentText(comment);

      if (comment) {
        if (multiline) {
          // A multi-line `@property` description (continuation lines) gets a block comment.
          const docComment = comment.includes("\n")
            ? `/**\n   * ${comment.split("\n").join("\n   * ")}\n   */`
            : `/** ${comment} */`;
          return `${docComment}\n  ${key}${optionalMarker}: ${type};`;
        }
        return `/** ${comment.replace(NEWLINES_REGEX, " ")} */ ${key}${optionalMarker}: ${type};`;
      }
      return `${key}${optionalMarker}: ${type};`;
    })
    .join(multiline ? "\n  " : " ");

  return multiline ? `{\n  ${props}\n}` : `{ ${props} }`;
}
