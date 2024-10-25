import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["ul"] & SvelteHTMLElements["ol"];

export interface RestPropsMultipleProps extends RestProps {
  /**
   * @default "ordered"
   */
  type?: "ordered" | "unordered";

  [key: `data-${string}`]: any;
}

export default class RestPropsMultiple extends SvelteComponentTyped<RestPropsMultipleProps, Record<string, any>, {}> {}
