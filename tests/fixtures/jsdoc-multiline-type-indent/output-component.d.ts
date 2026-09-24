import type { Component } from "svelte";

export type JsdocMultilineTypeIndentProps = {
  /**
   * Attributes of the underlying anchor.
   * @default {}
   */
  attributes?: import("svelte/elements")
    .SvelteHTMLElements["a"];

  /**
   * @default "md"
   */
  size?: "sm"
    | "md"
    | "lg";

  children?: (this: void) => void;
};

export type JsdocMultilineTypeIndentExports = Record<string, never>;

declare const JsdocMultilineTypeIndent: Component<
  JsdocMultilineTypeIndentProps,
  JsdocMultilineTypeIndentExports,
  ""
>;
export default JsdocMultilineTypeIndent;
