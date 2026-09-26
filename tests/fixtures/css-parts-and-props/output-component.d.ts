import type { Component } from "svelte";

export type CssPartsAndPropsProps = {
  /**
   * The card's title.
   * @default ""
   */
  title?: string;

  children?: (this: void) => void;
};

export type CssPartsAndPropsExports = Record<string, never>;

declare const CssPartsAndProps: Component<
  CssPartsAndPropsProps,
  CssPartsAndPropsExports,
  ""
>;
export default CssPartsAndProps;
