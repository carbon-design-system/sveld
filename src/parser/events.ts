import type { ArrayExpression, CallExpression, ObjectExpression, Property } from "sveast";
import { getPropertyName, isIdentifier, isLiteral, isNewExpressionNamed, isObjectExpression } from "../ast-guards";
import type { DispatchedEvent } from "../model";
import type { ParserContext } from "./context";
import { findTrackedVariableType } from "./contexts";
import { inferVariableInitializerType, literalValueType } from "./props";
import { isBoundInNestedScope } from "./scopes";
import { sourceRangeFromNode } from "./source-position";
import { escapeCommentText } from "./utils";

const NEWLINES_REGEX = /\n/g;
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

/**
 * How {@link deriveLiteralDetailType} types identifiers: via the component's
 * parse ({@link componentDetailTypeSource}), or a stand-in for a module read
 * without one (an imported dispatch helper).
 */
export type DetailTypeSource = {
  variableType(name: string): string | undefined;
};

/**
 * Types a detail's variables by annotation, else initializer. Names in
 * `nestedBoundNames` are shadowed at the dispatch, so they stay untyped.
 */
export function componentDetailTypeSource(
  ctx: ParserContext,
  nestedBoundNames?: ReadonlySet<string>,
): DetailTypeSource {
  return {
    variableType: (name) => {
      if (nestedBoundNames?.has(name)) return undefined;
      return findTrackedVariableType(ctx, name)?.type ?? inferVariableInitializerType(ctx, name);
    },
  };
}

/**
 * Names in a detail argument (`count`, `{ count }`, `[count]`) shadowed by a
 * nested scope at the dispatch. Must run during the walk, while those scopes
 * are live. `undefined` when there are none, which is almost always.
 */
export function detailNamesBoundInNestedScope(
  ctx: ParserContext,
  node: unknown,
  names?: Set<string>,
): Set<string> | undefined {
  if (!node || typeof node !== "object" || !("type" in node)) return names;
  if (isIdentifier(node)) {
    if (!isBoundInNestedScope(ctx, node.name)) return names;
    const found = names ?? new Set<string>();
    found.add(node.name);
    return found;
  }
  let found = names;
  if (isObjectExpression(node)) {
    for (const property of node.properties) {
      if (property.type === "Property") found = detailNamesBoundInNestedScope(ctx, property.value, found);
    }
  } else if (node.type === "ArrayExpression") {
    for (const element of (node as ArrayExpression).elements) {
      found = detailNamesBoundInNestedScope(ctx, element, found);
    }
  }
  return found;
}

/**
 * Detail type of a same-file dispatch argument that isn't a scalar literal:
 * an object or array literal structurally, a variable by its type. `undefined`
 * for anything else, so callers keep their scalar-literal narrowing.
 */
export function deriveDetailType(source: DetailTypeSource, node: unknown): string | undefined {
  if (isIdentifier(node)) return source.variableType(node.name);
  return deriveLiteralDetailType(source, node);
}

/**
 * Structural detail type of an object or array literal (`{ id: string }`,
 * `number[]`), falling back to `any` per member rather than for the whole
 * detail. `undefined` for anything else, so `dispatch("count", 5)` still
 * types as `5`.
 */
export function deriveLiteralDetailType(source: DetailTypeSource, node: unknown): string | undefined {
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;
  if (isObjectExpression(node)) return buildObjectLiteralDetailType(source, node);
  if (node.type === "ArrayExpression") return buildArrayLiteralDetailType(source, node as ArrayExpression);
  return undefined;
}

function inferLiteralMemberType(source: DetailTypeSource, node: unknown): string {
  if (!node || typeof node !== "object" || !("type" in node)) return "any";
  if (isIdentifier(node)) return source.variableType(node.name) ?? "any";

  if (isLiteral(node)) return literalValueType(node) ?? "null";

  if (isObjectExpression(node)) return buildObjectLiteralDetailType(source, node);
  if (node.type === "ArrayExpression") return buildArrayLiteralDetailType(source, node as ArrayExpression);

  return "any";
}

/**
 * `{}` types as `Record<string, never>` (never `null`, and not the banned bare `{}`). A spread or
 * computed key adds members sveld can't name, so it becomes a `[key: string]: any` index
 * signature alongside the known members, or `Record<string, any>` when there are none.
 */
function buildObjectLiteralDetailType(source: DetailTypeSource, node: ObjectExpression): string {
  if (node.properties.length === 0) return "Record<string, never>";

  const properties: Array<{ name: string; type: string }> = [];
  let hasUnknownMembers = false;
  for (const property of node.properties) {
    const name =
      property.type === "Property" && !property.computed ? getPropertyName(property.key as Property["key"]) : undefined;
    if (property.type !== "Property" || !name) {
      hasUnknownMembers = true;
      continue;
    }
    properties.push({ name, type: inferLiteralMemberType(source, property.value) });
  }

  if (!hasUnknownMembers) return buildEventDetailFromProperties(properties);
  if (properties.length === 0) return "Record<string, any>";
  return buildEventDetailFromProperties([...properties, { name: "[key: string]", type: "any" }]);
}

function buildArrayLiteralDetailType(source: DetailTypeSource, node: ArrayExpression): string {
  const elementTypes = new Set(
    node.elements.filter((element) => element != null).map((element) => inferLiteralMemberType(source, element)),
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

  const default_detail = !has_argument && !detail ? "null" : detail || undefined;
  const existing_event = ctx.events.get(name);
  if (existing_event?.type === "forwarded") {
    // Dispatched beats forwarded regardless of detection order (forwards are
    // seen mid-walk, dispatches resolve after it); the forward's metadata is a fallback.
    ctx.events.set(name, {
      type: "dispatched",
      name,
      detail: default_detail,
      description: description || existing_event.description,
      deprecated: deprecated ?? existing_event.deprecated,
      tags: tags ?? existing_event.tags,
      ...(internal || existing_event.internal ? { internal: true as const } : {}),
      source: source || existing_event.source,
    });
  } else if (existing_event) {
    // An untyped `@event`'s `null` detail is only a fallback: the first dispatch replaces it.
    const replacesUntypedDetail = ctx.untypedJsDocEventNames.delete(name);
    ctx.events.set(name, {
      ...existing_event,
      detail: existing_event.detail === undefined || replacesUntypedDetail ? default_detail : existing_event.detail,
      description: existing_event.description || description,
      deprecated: existing_event.deprecated ?? deprecated,
      tags: existing_event.tags ?? tags,
      ...(existing_event.internal || internal ? { internal: true as const } : {}),
      source: source || existing_event.source,
    });
  } else {
    ctx.events.set(name, {
      type: "dispatched",
      name,
      detail: default_detail,
      description,
      deprecated,
      tags,
      ...(internal ? { internal: true as const } : {}),
      source,
    });
  }
}

/** A `$host().dispatchEvent(...)` call read during the walk, recorded by {@link addHostDispatchedEvent}. */
export interface HostDispatch {
  name: string;
  detail: unknown;
  hasArgument: boolean;
  nestedBoundNames: Set<string> | undefined;
  source: DispatchedEvent["source"];
}

/**
 * Detect `$host().dispatchEvent(new CustomEvent("name", { detail }))` (or `new Event(...)`).
 * Recorded after the walk by {@link addHostDispatchedEvent}, once every variable is known.
 */
export function parseHostDispatchEventCall(
  ctx: ParserContext,
  dispatchEventCall: CallExpression,
): HostDispatch | undefined {
  const eventArg = dispatchEventCall.arguments[0];
  const isCustomEvent = isNewExpressionNamed(eventArg, "CustomEvent");
  if (!isCustomEvent && !isNewExpressionNamed(eventArg, "Event")) return undefined;

  const nameArg = eventArg.arguments[0];
  const eventName = isLiteral(nameArg) ? nameArg.value : undefined;
  if (eventName == null) return undefined;

  const optionsArg = isCustomEvent ? eventArg.arguments[1] : undefined;
  let hasArgument = false;
  let detail: unknown;
  if (isObjectExpression(optionsArg)) {
    const detailProperty = optionsArg.properties.find(
      (property) => property.type === "Property" && isIdentifier(property.key) && property.key.name === "detail",
    );
    if (detailProperty?.type === "Property") {
      hasArgument = true;
      detail = detailProperty.value;
    }
  }

  return {
    name: String(eventName),
    detail,
    hasArgument,
    nestedBoundNames: detailNamesBoundInNestedScope(ctx, detail),
    source: sourceRangeFromNode(ctx, dispatchEventCall),
  };
}

/** Records a {@link parseHostDispatchEventCall} event, its detail typed as a `dispatch()` detail is. */
export function addHostDispatchedEvent(ctx: ParserContext, dispatch: HostDispatch) {
  const typed = deriveDetailType(componentDetailTypeSource(ctx, dispatch.nestedBoundNames), dispatch.detail);
  const literal = typed === undefined && isLiteral(dispatch.detail) ? dispatch.detail.value : undefined;
  addDispatchedEvent(ctx, {
    name: dispatch.name,
    detail: typed ?? (literal == null ? "" : literalDetailToTypeText(literal)),
    has_argument: dispatch.hasArgument,
    source: dispatch.source,
  });
}

export function buildEventDetailFromProperties(
  properties: Array<{ name: string; type: string; description?: string; optional?: boolean; default?: string }>,
  multiline = false,
): string {
  if (properties.length === 0) return "null";

  const props = properties
    .map(({ name, type, description, optional, default: defaultValue }) => {
      const optionalMarker = optional ? "?" : "";
      // `"a-b"` needs its quotes back; `[key: string]` is an index signature, not a key.
      const key = IDENTIFIER_REGEX.test(name) || name.startsWith("[") ? name : JSON.stringify(name);
      const defaultTag = defaultValue ? `@default ${defaultValue}` : "";
      const comment = escapeCommentText(
        description && defaultTag ? `${description} ${defaultTag}` : description || defaultTag,
      );

      if (comment) {
        if (multiline) {
          // A multi-line `@property` description (continuation lines) gets a block comment; a
          // blank line (paragraph break) gets a bare `*`, with no trailing space.
          const docComment = comment.includes("\n")
            ? `/**\n${comment
                .split("\n")
                .map((line) => (line ? `   * ${line}` : "   *"))
                .join("\n")}\n   */`
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
