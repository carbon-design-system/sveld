import type { Component } from "svelte";

export type BindThisMultipleProps = {
  ref: null | HTMLButtonElement | HTMLHeadingElement;

  ref2: null | HTMLDivElement;

  /**
   * @default false
   */
  propBool?: boolean;

  children?: (this: void) => void;
};

export type BindThisMultipleExports = Record<string, never>;

declare const BindThisMultiple: Component<
  BindThisMultipleProps,
  BindThisMultipleExports,
  ""
>;
export default BindThisMultiple;
