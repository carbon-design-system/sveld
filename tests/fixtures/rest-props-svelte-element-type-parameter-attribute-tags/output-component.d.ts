import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
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

export type RestPropsSvelteElementTypeParameterAttributeTagsExports = Record<string, never>;

interface RestPropsSvelteElementTypeParameterAttributeTagsComponent {
  new <Tag extends "div" | "img" | "section" = "div">(
    options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>>
  ): SvelteComponent<RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>> & RestPropsSvelteElementTypeParameterAttributeTagsExports;
  <Tag extends "div" | "img" | "section" = "div">(
    this: void,
    internals: ComponentInternals,
    props: RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RestPropsSvelteElementTypeParameterAttributeTagsProps<Tag>>): void;
  } & RestPropsSvelteElementTypeParameterAttributeTagsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RestPropsSvelteElementTypeParameterAttributeTags: RestPropsSvelteElementTypeParameterAttributeTagsComponent;
export default RestPropsSvelteElementTypeParameterAttributeTags;
