import type { CallExpression, Expression, Identifier, Literal, MemberExpression, ObjectExpression } from "estree";
import type ComponentParser from "../ComponentParser";
import type { DeprecatedValue, JsDocPassthroughTag, SlotProps, SlotPropValue, SourceRange } from "../ComponentParser";
import { resolveMemberExpressionType } from "./bindings";
import type { ParserContext } from "./context";
import { sourceAtPos } from "./source-position";
import { assignValueOrUndefined } from "./utils";

const DEFAULT_SLOT_NAME = null;

export function inferSlotPropValueFromExpression(
  ctx: ParserContext,
  parser: ComponentParser,
  expression: unknown,
): SlotPropValue {
  const slot_prop_value: SlotPropValue = {
    value: undefined,
    replace: false,
  };

  if (!expression || typeof expression !== "object" || !("type" in expression)) {
    return slot_prop_value;
  }

  if (expression.type === "Identifier") {
    slot_prop_value.value = (expression as Identifier).name;
    slot_prop_value.replace = true;
  } else if (expression.type === "Literal") {
    slot_prop_value.value = String((expression as Literal).value);
  } else if (expression.type === "MemberExpression") {
    slot_prop_value.value = resolveMemberExpressionType(ctx, parser, expression);
  } else if (
    (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") &&
    "start" in expression &&
    "end" in expression &&
    typeof expression.start === "number" &&
    typeof expression.end === "number"
  ) {
    slot_prop_value.value = sourceAtPos(ctx, expression.start, expression.end);
  }

  return slot_prop_value;
}

export function buildSlotPropsFromObjectExpression(
  ctx: ParserContext,
  parser: ComponentParser,
  expression: ObjectExpression,
): SlotProps {
  const slot_props: SlotProps = {};

  for (const property of expression.properties) {
    if (property.type !== "Property" || property.computed) continue;

    const propName = parser.getPropertyName(property.key);
    if (!propName) continue;
    slot_props[propName] = inferSlotPropValueFromExpression(ctx, parser, property.value);
  }

  return slot_props;
}

export function resolveRenderTagPropReference(
  ctx: ParserContext,
  callee: unknown,
): { publicName: string; trackingName: string } | null {
  if (!callee || typeof callee !== "object" || !("type" in callee)) {
    return null;
  }

  if (callee.type === "Identifier") {
    const identifier = callee as Identifier;
    const publicName = ctx.propLocalToPublicName.get(identifier.name);
    if (!publicName) return null;

    return {
      publicName,
      trackingName: identifier.name,
    };
  }

  if (callee.type !== "MemberExpression") {
    return null;
  }

  const memberExpression = callee as MemberExpression;
  const objectName =
    memberExpression.object &&
    typeof memberExpression.object === "object" &&
    "type" in memberExpression.object &&
    memberExpression.object.type === "Identifier"
      ? memberExpression.object.name
      : undefined;
  if (!objectName || !ctx.wholePropsLocals.has(objectName)) {
    return null;
  }

  let publicName: string | undefined;
  if (
    !memberExpression.computed &&
    memberExpression.property &&
    typeof memberExpression.property === "object" &&
    "type" in memberExpression.property
  ) {
    if (memberExpression.property.type === "Identifier") {
      publicName = memberExpression.property.name;
    } else if (memberExpression.property.type === "Literal" && memberExpression.property.value != null) {
      publicName = String(memberExpression.property.value);
    }
  } else if (
    memberExpression.computed &&
    memberExpression.property &&
    typeof memberExpression.property === "object" &&
    "type" in memberExpression.property &&
    memberExpression.property.type === "Literal" &&
    "value" in memberExpression.property &&
    memberExpression.property.value != null
  ) {
    publicName = String(memberExpression.property.value);
  }

  if (!publicName) return null;

  return {
    publicName,
    trackingName: publicName,
  };
}

export function extractRenderTagInfo(
  ctx: ParserContext,
  expression: unknown,
): { publicName: string; trackingName: string; arguments: Array<Expression | unknown> } | null {
  let callExpression = expression;

  if (
    callExpression &&
    typeof callExpression === "object" &&
    "type" in callExpression &&
    callExpression.type === "ChainExpression"
  ) {
    callExpression = (callExpression as { expression?: unknown }).expression;
  }

  if (
    !callExpression ||
    typeof callExpression !== "object" ||
    !("type" in callExpression) ||
    callExpression.type !== "CallExpression"
  ) {
    return null;
  }

  const callExpr = callExpression as CallExpression;

  if (!callExpr.callee || typeof callExpr.callee !== "object" || !("type" in callExpr.callee)) {
    return null;
  }

  const propReference = resolveRenderTagPropReference(ctx, callExpr.callee);
  if (!propReference) return null;

  return {
    ...propReference,
    arguments: callExpr.arguments,
  };
}

export function addSlot(
  ctx: ParserContext,
  {
    slot_name,
    slot_props,
    slot_fallback,
    slot_description,
    slot_deprecated,
    slot_tags,
    source,
  }: {
    slot_name?: string;
    slot_props?: string | SlotProps;
    slot_fallback?: string;
    slot_description?: string;
    slot_deprecated?: DeprecatedValue;
    slot_tags?: JsDocPassthroughTag[];
    source?: SourceRange;
  },
) {
  const default_slot = slot_name === undefined || slot_name === "";
  const name: string | null = default_slot ? DEFAULT_SLOT_NAME : (slot_name ?? "");
  const fallback = assignValueOrUndefined(slot_fallback);
  const props = slot_props === undefined || slot_props === "" ? undefined : slot_props;
  const description = slot_description?.trim() || undefined;

  if (ctx.slots.has(name)) {
    const existing_slot = ctx.slots.get(name);
    if (existing_slot) {
      ctx.slots.set(name, {
        ...existing_slot,
        default: existing_slot.default ?? default_slot,
        fallback,
        slot_props: existing_slot.slot_props === undefined ? props : existing_slot.slot_props,
        description: existing_slot.description || description,
        deprecated: existing_slot.deprecated ?? slot_deprecated,
        tags: existing_slot.tags || slot_tags,
        source: source || existing_slot.source,
      });
    }
  } else {
    ctx.slots.set(name, {
      name,
      default: default_slot,
      fallback,
      slot_props,
      description,
      deprecated: slot_deprecated,
      tags: slot_tags,
      source,
    });
  }
}
