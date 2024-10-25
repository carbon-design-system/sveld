import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Set to `true` to stack the buttons vertically
   * @default false
   */
  stacked?: boolean;

  [key: `data-${string}`]: any;
};

export type ButtonSetProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class ButtonSet extends SvelteComponentTyped<
  ButtonSetProps,
  Record<string, any>,
  { default: {} }
> {}
