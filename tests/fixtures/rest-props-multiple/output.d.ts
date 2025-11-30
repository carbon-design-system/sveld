import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["ul"] & SvelteHTMLElements["ol"];

type $Props = {
  /**
   * @default "ordered"
   */
  type?: "ordered" | "unordered";

  [key: `data-${string}`]: any;
};

export type RestPropsMultipleProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RestPropsMultiple extends SvelteComponentTyped<
  RestPropsMultipleProps,
  Record<string, any>,
  Record<string, never>
> {}
