import type { AST, ObjectExpression, Property, SimpleCallExpression } from "sveast";
import { getPropertyName, isIdentifier, isObjectExpression } from "../ast-guards";
import type { DeprecatedValue, JsDocPassthroughTag, SlotProps, SlotPropValue, SourceRange } from "../model";
import { resolveMemberExpressionType } from "./bindings";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import { parseObjectTypeLiteralMembers } from "./object-type-literal";
import { resolveConstInitializer } from "./props";
import { sourceAtPos, sourceRangeFromNode } from "./source-position";
import { findVariableTypeAndDescription } from "./variable-jsdoc";

export const DEFAULT_SLOT_NAME = null;

/** `ctx.slots` key for a slot name; `default` is the default slot, as in Svelte. */
export function slotKey(slot_name: string | undefined) {
  return !slot_name || slot_name === "default" ? DEFAULT_SLOT_NAME : slot_name;
}

function inferSlotPropValueFromExpression(ctx: ParserContext, expression: Property["value"]): SlotPropValue {
  const slot_prop_value: SlotPropValue = { value: undefined, replace: false };

  if (expression.type === "Identifier") {
    slot_prop_value.value = expression.name;
    slot_prop_value.replace = true;
  } else if (expression.type === "Literal") {
    slot_prop_value.value = String(expression.value);
  } else if (expression.type === "MemberExpression") {
    slot_prop_value.value = resolveMemberExpressionType(ctx, expression);
  } else if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
    slot_prop_value.value = sourceAtPos(ctx, expression.start, expression.end);
  }

  return slot_prop_value;
}

/**
 * `{...identifier}` in a `{@render x({...})}` argument: the object literal it's
 * bound to, else the members of its object-type annotation. `null` when
 * neither resolves, so the caller widens to `Record<string, any>`.
 */
function resolveSlotSpreadShape(ctx: ParserContext, argument: unknown): SlotProps | null {
  if (!isIdentifier(argument)) return null;

  const initializer = resolveConstInitializer(ctx, argument.name);
  if (isObjectExpression(initializer)) {
    return buildSlotPropsFromObjectExpression(ctx, initializer).slot_props;
  }

  const varInfo = findVariableTypeAndDescription(ctx, argument.name);
  if (!varInfo) return null;

  const members = parseObjectTypeLiteralMembers(varInfo.type);
  if (!members) return null;

  const slot_props: SlotProps = {};
  for (const member of members) {
    slot_props[member.name] = { value: member.type, replace: false };
  }
  return slot_props;
}

export function buildSlotPropsFromObjectExpression(
  ctx: ParserContext,
  expression: ObjectExpression,
): { slot_props: SlotProps; hasUnresolvedSpread: boolean } {
  const slot_props: SlotProps = {};
  let hasUnresolvedSpread = false;

  for (const property of expression.properties) {
    if (property.type === "SpreadElement") {
      const merged = resolveSlotSpreadShape(ctx, property.argument);
      if (merged) {
        Object.assign(slot_props, merged);
      } else {
        hasUnresolvedSpread = true;
        recordDiagnostic(
          ctx,
          "spread-unresolved",
          "slot_props",
          'Slot props spread a value sveld can\'t resolve; its shape is widened to "Record<string, any>".',
          sourceRangeFromNode(ctx, property),
        );
      }
      continue;
    }

    if (property.type !== "Property" || property.computed) continue;

    const propName = getPropertyName(property.key);
    if (!propName) continue;
    slot_props[propName] = inferSlotPropValueFromExpression(ctx, property.value);
  }

  return { slot_props, hasUnresolvedSpread };
}

function resolveRenderTagPropReference(
  ctx: ParserContext,
  callee: SimpleCallExpression["callee"],
): { publicName: string; trackingName: string } | null {
  if (callee.type === "Identifier") {
    const publicName = ctx.propLocalToPublicName.get(callee.name);
    return publicName ? { publicName, trackingName: callee.name } : null;
  }

  if (callee.type !== "MemberExpression") return null;
  if (callee.object.type !== "Identifier" || !ctx.wholePropsLocals.has(callee.object.name)) return null;

  const { property } = callee;
  let publicName: string | undefined;
  if (!callee.computed && property.type === "Identifier") {
    publicName = property.name;
  } else if (property.type === "Literal" && property.value != null) {
    publicName = String(property.value);
  }

  return publicName ? { publicName, trackingName: publicName } : null;
}

export function extractRenderTagInfo(ctx: ParserContext, expression: AST.RenderTag["expression"]) {
  const call = expression.type === "ChainExpression" ? expression.expression : expression;
  const propReference = resolveRenderTagPropReference(ctx, call.callee);
  return propReference && { ...propReference, arguments: call.arguments };
}

export function addSlot(
  ctx: ParserContext,
  {
    slot_name,
    slot_props,
    slot_props_unresolved_spread,
    slot_fallback,
    slot_description,
    slot_deprecated,
    slot_tags,
    slot_internal,
    source,
  }: {
    slot_name?: string;
    slot_props?: string | SlotProps;
    slot_props_unresolved_spread?: boolean;
    slot_fallback?: string;
    slot_description?: string;
    slot_deprecated?: DeprecatedValue;
    slot_tags?: JsDocPassthroughTag[];
    slot_internal?: boolean;
    source?: SourceRange;
  },
) {
  const name = slotKey(slot_name);
  const default_slot = name === DEFAULT_SLOT_NAME;
  const fallback = slot_fallback || undefined;
  const props = slot_props === undefined || slot_props === "" ? undefined : slot_props;
  const description = slot_description?.trim() || undefined;

  const existing_slot = ctx.slots.get(name);
  if (existing_slot) {
    ctx.slots.set(name, {
      ...existing_slot,
      default: existing_slot.default ?? default_slot,
      fallback,
      slot_props: existing_slot.slot_props === undefined ? props : existing_slot.slot_props,
      slot_props_unresolved_spread: existing_slot.slot_props_unresolved_spread || slot_props_unresolved_spread,
      description: existing_slot.description || description,
      deprecated: existing_slot.deprecated ?? slot_deprecated,
      tags: existing_slot.tags || slot_tags,
      ...(existing_slot.internal || slot_internal ? { internal: true as const } : {}),
      source: source || existing_slot.source,
    });
  } else {
    ctx.slots.set(name, {
      name,
      default: default_slot,
      fallback,
      slot_props: props,
      slot_props_unresolved_spread,
      description,
      deprecated: slot_deprecated,
      tags: slot_tags,
      ...(slot_internal ? { internal: true as const } : {}),
      source,
    });
  }
}
