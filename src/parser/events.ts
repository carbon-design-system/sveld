import type { DispatchedEvent } from "../ComponentParser";
import type { ParserContext } from "./context";

/** Returns `value`, or `undefined` when it's `undefined` or the empty string. */
function assignValueOrUndefined(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
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
  if (ctx.events.has(name)) {
    const existing_event = ctx.events.get(name) as DispatchedEvent;
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
