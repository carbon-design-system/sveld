import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["ul"] & SvelteHTMLElements["ol"];

type $ComponentProps = {
  /**
   * @default "ordered"
   */
  type?: "ordered" | "unordered";

  [key: `data-${string}`]: any;
};

export type RestPropsMultipleProps = Omit<RestProps, keyof $ComponentProps> & $ComponentProps;

export default class RestPropsMultiple extends SvelteComponentTyped<RestPropsMultipleProps, Record<string, any>, {}> {}
