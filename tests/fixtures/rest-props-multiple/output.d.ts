import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["h1"] & SvelteHTMLElements["span"];

export interface RestPropsMultipleProps extends RestProps {
  /**
   * @default false
   */
  edit?: boolean;

  /**
   * @default false
   */
  heading?: boolean;

  [key: `data-${string}`]: any;
}

export default class RestPropsMultiple extends SvelteComponentTyped<RestPropsMultipleProps, Record<string, any>, {}> {}
