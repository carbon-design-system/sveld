import type { Component } from "svelte";

export type CemCssPartsAndPropsProps = {
  /**
   * The card's title.
   * @default ""
   */
  title?: string;

  children?: (this: void) => void;
};

export type CemCssPartsAndPropsExports = Record<string, never>;

declare const CemCssPartsAndProps: Component<
  CemCssPartsAndPropsProps,
  CemCssPartsAndPropsExports,
  ""
>;
export default CemCssPartsAndProps;
