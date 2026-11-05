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
   * @default { text: "" }
   */
  title?: any;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag extends keyof HTMLElementTagNameMap = "div"> = (Tag extends any ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : never) & $Props<Tag>;

export type RestPropsSvelteElementTypeParameterAttributeCommonExports = Record<string, never>;

interface RestPropsSvelteElementTypeParameterAttributeCommonComponent {
  new <Tag extends keyof HTMLElementTagNameMap = "div">(
    options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>>
  ): SvelteComponent<RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>> & RestPropsSvelteElementTypeParameterAttributeCommonExports;
  <Tag extends keyof HTMLElementTagNameMap = "div">(
    this: void,
    internals: ComponentInternals,
    props: RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>>): void;
  } & RestPropsSvelteElementTypeParameterAttributeCommonExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RestPropsSvelteElementTypeParameterAttributeCommon: RestPropsSvelteElementTypeParameterAttributeCommonComponent;
export default RestPropsSvelteElementTypeParameterAttributeCommon;
