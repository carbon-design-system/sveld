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
   * @default null
   */
  ref?: null | HTMLElementTagNameMap[Tag];

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterProps<Tag extends keyof HTMLElementTagNameMap = "div"> = $RestProps<Tag> & $Props<Tag>;

export default class RestPropsSvelteElementTypeParameter<Tag extends keyof HTMLElementTagNameMap = "div"> extends SvelteComponentTyped<
  RestPropsSvelteElementTypeParameterProps<Tag>,
  Record<string, any>,
  { default: Record<string, never> }
> {
  constructor(options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterProps<Tag>>);
}
