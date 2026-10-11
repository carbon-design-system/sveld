import type { AST, Expression } from "sveast";
import {
  isCallExpressionNamed,
  isComponentLikeType,
  isElementLikeType,
  isIdentifier,
  isObjectExpression,
  unwrapTypeCastExpression,
} from "../ast-guards";
import type { ComponentElement, RestProps } from "../model";
import type { ParserContext } from "./context";
import { sourceRangeFromNode } from "./source-position";

function createRestPropsFromParent(parent: unknown): RestProps {
  if (!parent || typeof parent !== "object" || !("type" in parent)) return undefined;

  const parentType = String(parent.type);
  const isComponentLike = isComponentLikeType(parentType);
  if (!isComponentLike && !isElementLikeType(parentType)) return undefined;

  const parentName = "name" in parent && typeof parent.name === "string" ? parent.name : undefined;
  if (!parentName) return undefined;

  if (isComponentLike) return { type: "InlineComponent", name: parentName };

  const restProps: ComponentElement = { type: "Element", name: parentName };
  // `<svelte:element this="div">` has a static `Literal` tag; `this={expr}` doesn't.
  if (parentName === "svelte:element" && "tag" in parent && parent.tag && typeof parent.tag === "object") {
    const tag = parent.tag as { type?: string; value?: unknown };
    if (tag.type === "Literal" && typeof tag.value === "string") restProps.thisValue = tag.value;
  }
  return restProps;
}

export function maybeSetRestProps(ctx: ParserContext, parent: unknown, spread: AST.SpreadAttribute) {
  const restProps = createRestPropsFromParent(parent);
  if (!restProps) return;

  // A plain element target is typeable; a component target is not. Prefer the
  // first element target seen over an earlier component target, regardless of
  // template order, so one untypeable spread doesn't shadow a typeable one.
  if (ctx.rest_props !== undefined && !(ctx.rest_props.type === "InlineComponent" && restProps.type === "Element")) {
    return;
  }
  ctx.rest_props = restProps;
  const tag = parent && typeof parent === "object" && "tag" in parent ? parent.tag : undefined;
  ctx.restPropsTagLocal = restProps.name === "svelte:element" && isIdentifier(tag) ? tag.name : undefined;
  ctx.restPropsSource = sourceRangeFromNode(ctx, spread);
}

/** The rest props name (`$$restProps` or a runes rest local) an object literal initializer spreads. */
function restPropsSpreadIn(ctx: ParserContext, init: Expression | null | undefined): string | undefined {
  let value = unwrapTypeCastExpression(init);
  if (isCallExpressionNamed(value, "$derived")) value = unwrapTypeCastExpression(value.arguments[0] as Expression);
  if (!isObjectExpression(value)) return undefined;

  for (const property of value.properties) {
    if (property.type !== "SpreadElement" || !isIdentifier(property.argument)) continue;
    const { name } = property.argument;
    if (name === "$$restProps" || ctx.restPropLocals.has(name)) return name;
  }
  return undefined;
}

/**
 * Top-level locals whose object literal spreads rest props, mapped to the rest
 * name spread: `props` in `$: props = { ...$$restProps, class }`, which the
 * template then spreads in turn. One level only: an object spreading such a
 * local isn't followed. Reads `ctx.restPropLocals`, so call it once the
 * instance script has been walked.
 */
export function collectRestPropsObjectLocals(ctx: ParserContext, instance: AST.Script | undefined) {
  const locals = new Map<string, string>();
  for (const statement of instance?.content.body ?? []) {
    if (statement.type === "VariableDeclaration") {
      for (const { id, init } of statement.declarations) {
        const restName = isIdentifier(id) ? restPropsSpreadIn(ctx, init) : undefined;
        if (restName && isIdentifier(id)) locals.set(id.name, restName);
      }
      continue;
    }

    if (statement.type !== "LabeledStatement" || statement.label.name !== "$") continue;
    if (statement.body.type !== "ExpressionStatement") continue;
    const assignment = statement.body.expression;
    if (assignment.type !== "AssignmentExpression" || assignment.operator !== "=" || !isIdentifier(assignment.left)) {
      continue;
    }
    const restName = restPropsSpreadIn(ctx, assignment.right);
    if (restName) locals.set(assignment.left.name, restName);
  }
  return locals;
}
