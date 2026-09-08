import { SvelteComponentTyped } from "svelte";

export type CemCssPartsAndPropsProps = {
  /**
   * The card's title.
   * @default ""
   */
  title?: string;

  children?: (this: void) => void;
};

export default class CemCssPartsAndProps extends SvelteComponentTyped<
  CemCssPartsAndPropsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
