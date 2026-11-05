import { SvelteComponentTyped, type ComponentConstructorOptions } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Tag extends keyof HTMLElementTagNameMap = "div"> = NoInfer<SvelteHTMLElements[Tag]>;

type $Props<Tag extends keyof HTMLElementTagNameMap = "div"> = {
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

export type RestPropsSvelteElementTypeParameterAttributeTagProps<Tag extends keyof HTMLElementTagNameMap = "div"> = (Tag extends "canvas" | "col" | "embed" | "iframe" | "img" | "input" | "object" | "source" | "table" | "td" | "video" ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : $RestProps<Tag>) & $Props<Tag>;

export default class RestPropsSvelteElementTypeParameterAttributeTag<Tag extends keyof HTMLElementTagNameMap = "div"> extends SvelteComponentTyped<
  RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>,
  Record<string, any>,
  { default: Record<string, never> }
> {
  constructor(options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>>);
}
