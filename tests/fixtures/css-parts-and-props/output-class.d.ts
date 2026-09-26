import { SvelteComponentTyped } from "svelte";

export type CssPartsAndPropsProps = {
  /**
   * The card's title.
   * @default ""
   */
  title?: string;

  children?: (this: void) => void;
};

export default class CssPartsAndProps extends SvelteComponentTyped<
  CssPartsAndPropsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
