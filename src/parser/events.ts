import type { CallExpression } from "estree";
import { isIdentifier, isLiteral, isNewExpressionNamed, isObjectExpression } from "../ast-guards";
import type { DispatchedEvent } from "../ComponentParser";
import type { ParserContext } from "./context";
import { sourceRangeFromNode } from "./source-position";

/** Returns `value`, or `undefined` when it's `undefined` or the empty string. */
function assignValueOrUndefined(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}

/** Render a literal event-detail value (from a `dispatch()`/`CustomEvent` argument) as TS type text, quoting strings. */
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
    source,
  }: Pick<DispatchedEvent, "name" | "description" | "deprecated" | "tags" | "source"> & {
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
      source: source || existing_event.source,
    });
  } else if (existing_event) {
    const merged_tags = existing_event.tags ?? tags;
    ctx.events.set(name, {
      ...existing_event,
      detail: existing_event.detail === undefined ? default_detail : existing_event.detail,
      description: existing_event.description || event_description,
      deprecated: existing_event.deprecated ?? deprecated,
      tags: merged_tags,
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

/** Build an inline object type (with optional JSDoc per property) for event details or typedefs. */
export function buildEventDetailFromProperties(
  properties: Array<{ name: string; type: string; description?: string; optional?: boolean; default?: string }>,
  _eventName?: string,
  multiline = false,
): string {
  if (properties.length === 0) return "null";

  const props = properties
    .map(({ name, type, description, optional, default: defaultValue }) => {
      const optionalMarker = optional ? "?" : "";
      let comment = description || "";

      if (defaultValue && comment) {
        comment = `${comment} @default ${defaultValue}`;
      } else if (defaultValue) {
        comment = `@default ${defaultValue}`;
      }

      if (comment) {
        if (multiline) {
          return `/** ${comment} */\n  ${name}${optionalMarker}: ${type};`;
        }
        return `/** ${comment} */ ${name}${optionalMarker}: ${type};`;
      }
      return `${name}${optionalMarker}: ${type};`;
    })
    .join(multiline ? "\n  " : " ");

  return multiline ? `{\n  ${props}\n}` : `{ ${props} }`;
}
