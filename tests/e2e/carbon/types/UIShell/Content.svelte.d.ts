import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["main"];

type $ComponentProps = {
  /**
   * Specify the id for the main element
   * @default "main-content"
   */
  id?: string;

  [key: `data-${string}`]: any;
};

export type ContentProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Content extends SvelteComponentTyped<
  ContentProps,
  Record<string, any>,
  { default: {} }
> {}
