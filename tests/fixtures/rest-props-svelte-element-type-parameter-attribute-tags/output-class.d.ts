import { SvelteComponentTyped, type ComponentConstructorOptions } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Tag extends "div" | "img" | "section" = "div"> = NoInfer<SvelteHTMLElements[Tag]>;

type $Props<Tag extends "div" | "img" | "section" = "div"> = {
  /**
   * Specify the element to render.
   * @default "div"
   */
  tag?: Tag;

  /**
   * Named as an attribute of some elements, which it replaces there.
   * @default "auto"
   */
  width?: "full" | "auto";

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag extends "div" | "img" | "section" = "div"> = (Tag extends "img" ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : $RestProps<Tag>) & $Props<Tag>;

export default class RestPropsSvelteElementTypeParameterAttributeTags<Tag extends "div" | "img" | "section" = "div"> extends SvelteComponentTyped<
  RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>,
  Record<string, any>,
  { default: Record<string, never> }
> {
  constructor(options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>>);
}
