import type { Component } from "svelte";

export type CustomElementOptionsTagProps = {
  /**
   * The badge label.
   * @default ""
   */
  label?: string;

  children?: (this: void) => void;
};

export type CustomElementOptionsTagExports = Record<string, never>;

declare const CustomElementOptionsTag: Component<
  CustomElementOptionsTagProps,
  CustomElementOptionsTagExports,
  ""
>;
export default CustomElementOptionsTag;
