import type { ComponentElement, RestProps } from "../ComponentParser";
import type { ParserContext } from "./context";
import { isComponentLikeType, isElementLikeType } from "./element-kind";

function createRestPropsFromParent(parent: unknown): RestProps {
  if (!parent || typeof parent !== "object" || !("type" in parent)) return undefined;

  const parentType = String(parent.type);
  const isComponentLike = isComponentLikeType(parentType);
  if (!isComponentLike && !isElementLikeType(parentType)) return undefined;

  const parentName = "name" in parent && typeof parent.name === "string" ? parent.name : undefined;
  if (!parentName) return undefined;

  const restProps: RestProps = isComponentLike
    ? {
        type: "InlineComponent",
        name: parentName,
      }
    : {
        type: "Element",
        name: parentName,
      };

  // `<svelte:element this="div">`: modern AST always stores `.tag` as a node.
  // A `Literal` has a static tag name. `this={expr}` does not.
  if (parentName === "svelte:element" && "tag" in parent && parent.tag && typeof parent.tag === "object") {
    const tag = parent.tag as { type?: string; value?: unknown };
    if (tag.type === "Literal" && typeof tag.value === "string") {
      (restProps as ComponentElement).thisValue = tag.value;
    }
  }

  return restProps;
}

export function maybeSetRestProps(ctx: ParserContext, parent: unknown) {
  const restProps = createRestPropsFromParent(parent);
  if (!restProps) return;

  if (ctx.rest_props === undefined) {
    ctx.rest_props = restProps;
    return;
  }

  // A plain element target is typeable; a component target is not. Prefer the
  // first element target seen over an earlier component target, regardless of
  // template order, so one untypeable spread doesn't shadow a typeable one.
  if (ctx.rest_props.type === "InlineComponent" && restProps.type === "Element") {
    ctx.rest_props = restProps;
  }
}
