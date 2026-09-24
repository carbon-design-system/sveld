import { SvelteComponentTyped } from "svelte";

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

export default class JsdocMultilineTypeIndent extends SvelteComponentTyped<
  JsdocMultilineTypeIndentProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
