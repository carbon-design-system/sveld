import type { ComponentElement, RestProps } from "../ComponentParser";
import type { ParserContext } from "./context";

/** {@link RestProps} for the parent of a `{...$$restProps}` spread. */
export function createRestPropsFromParent(parent: unknown): RestProps {
  if (!parent || typeof parent !== "object" || !("type" in parent)) return undefined;

  const parentType = String(parent.type);
  if (parentType !== "InlineComponent" && parentType !== "Element") return undefined;

  const parentName = "name" in parent && typeof parent.name === "string" ? parent.name : undefined;
  if (!parentName) return undefined;

  const restProps: RestProps =
    parentType === "InlineComponent"
      ? {
          type: "InlineComponent",
          name: parentName,
        }
      : {
          type: "Element",
          name: parentName,
        };

  if (
    parentType === "Element" &&
    parentName === "svelte:element" &&
    "tag" in parent &&
    typeof parent.tag === "string"
  ) {
    (restProps as ComponentElement).thisValue = parent.tag;
  }

  return restProps;
}

/** Record the first `{...$$restProps}` target on `ctx.rest_props`. */
export function maybeSetRestProps(ctx: ParserContext, parent: unknown) {
  if (ctx.rest_props !== undefined) return;

  const restProps = createRestPropsFromParent(parent);
  if (restProps) {
    ctx.rest_props = restProps;
  }
}
