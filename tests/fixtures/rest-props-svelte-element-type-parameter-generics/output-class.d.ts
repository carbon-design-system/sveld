import { SvelteComponentTyped, type ComponentConstructorOptions } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Item, Tag extends keyof HTMLElementTagNameMap = "ul"> = NoInfer<SvelteHTMLElements[Tag]>;

type $Elements<Item> = { [$Tag in keyof HTMLElementTagNameMap]: Omit<$RestProps<Item, $Tag>, keyof $Props<Item, $Tag>> };

type $Props<Item, Tag extends keyof HTMLElementTagNameMap = "ul"> = {
  /**
   * Specify the element to render.
   * @default "ul"
   */
  tag?: Tag;

  /**
   * @default []
   */
  items?: Item[];

  children?: (this: void, ...args: [{ item: any }]) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag extends keyof HTMLElementTagNameMap = "ul"> = $Elements<Item>[Tag] & $Props<Item, Tag>;

export default class RestPropsSvelteElementTypeParameterGenerics<Item, Tag extends keyof HTMLElementTagNameMap = "ul"> extends SvelteComponentTyped<
  RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>,
  Record<string, any>,
  { default: { item: any } }
> {
  constructor(options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>>);
}
