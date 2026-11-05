import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
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

export type RestPropsSvelteElementTypeParameterAttributeTagExports = Record<string, never>;

interface RestPropsSvelteElementTypeParameterAttributeTagComponent {
  new <Tag extends keyof HTMLElementTagNameMap = "div">(
    options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>>
  ): SvelteComponent<RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>> & RestPropsSvelteElementTypeParameterAttributeTagExports;
  <Tag extends keyof HTMLElementTagNameMap = "div">(
    this: void,
    internals: ComponentInternals,
    props: RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RestPropsSvelteElementTypeParameterAttributeTagProps<Tag>>): void;
  } & RestPropsSvelteElementTypeParameterAttributeTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RestPropsSvelteElementTypeParameterAttributeTag: RestPropsSvelteElementTypeParameterAttributeTagComponent;
export default RestPropsSvelteElementTypeParameterAttributeTag;
