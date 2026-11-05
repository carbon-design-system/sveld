import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
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

export type RestPropsSvelteElementTypeParameterGenericsExports = Record<string, never>;

interface RestPropsSvelteElementTypeParameterGenericsComponent {
  new <Item, Tag extends keyof HTMLElementTagNameMap = "ul">(
    options: ComponentConstructorOptions<RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>>
  ): SvelteComponent<RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>> & RestPropsSvelteElementTypeParameterGenericsExports;
  <Item, Tag extends keyof HTMLElementTagNameMap = "ul">(
    this: void,
    internals: ComponentInternals,
    props: RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RestPropsSvelteElementTypeParameterGenericsProps<Item, Tag>>): void;
  } & RestPropsSvelteElementTypeParameterGenericsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RestPropsSvelteElementTypeParameterGenerics: RestPropsSvelteElementTypeParameterGenericsComponent;
export default RestPropsSvelteElementTypeParameterGenerics;
