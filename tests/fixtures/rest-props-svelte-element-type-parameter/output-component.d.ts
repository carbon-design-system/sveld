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
   * @default null
   */
  ref?: null | HTMLElementTagNameMap[Tag];

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterProps<Tag extends keyof HTMLElementTagNameMap = "div"> = (Tag extends any ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : never) & $Props<Tag>;

export type RestPropsSvelteElementTypeParameterExports = Record<string, never>;

interface RestPropsSvelteElementTypeParameterComponent {
  new <Tag extends keyof HTMLElementTagNameMap = "div">(
    options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterProps<Tag>>
  ): SvelteComponent<RestPropsSvelteElementTypeParameterProps<Tag>> & RestPropsSvelteElementTypeParameterExports;
  <Tag extends keyof HTMLElementTagNameMap = "div">(
    this: void,
    internals: ComponentInternals,
    props: RestPropsSvelteElementTypeParameterProps<Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RestPropsSvelteElementTypeParameterProps<Tag>>): void;
  } & RestPropsSvelteElementTypeParameterExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RestPropsSvelteElementTypeParameter: RestPropsSvelteElementTypeParameterComponent;
export default RestPropsSvelteElementTypeParameter;
