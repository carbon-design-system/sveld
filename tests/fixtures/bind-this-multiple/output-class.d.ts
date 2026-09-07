import { SvelteComponentTyped } from "svelte";

export type BindThisMultipleProps = {
  ref: null | HTMLButtonElement | HTMLHeadingElement;

  ref2: null | HTMLDivElement;

  /**
   * @default false
   */
  propBool?: boolean;

  children?: (this: void) => void;
};

export default class BindThisMultiple extends SvelteComponentTyped<
  BindThisMultipleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
