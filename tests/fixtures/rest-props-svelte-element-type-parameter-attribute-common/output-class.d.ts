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
   * @default { text: "" }
   */
  title?: any;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag extends keyof HTMLElementTagNameMap = "div"> = (Tag extends any ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : never) & $Props<Tag>;

export default class RestPropsSvelteElementTypeParameterAttributeCommon<Tag extends keyof HTMLElementTagNameMap = "div"> extends SvelteComponentTyped<
  RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>,
  Record<string, any>,
  { default: Record<string, never> }
> {
  constructor(options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterAttributeCommonProps<Tag>>);
}
