import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

/**
 * Rest props are spread to the span (inline variant)
 * or the copy button (single/multi).
 */
type $RestProps = SvelteHTMLElements["button"] & SvelteHTMLElements["span"];

type $Props = {
  /**
   * @default "single"
   */
  variant?: "inline" | "single" | "multi";

  [key: `data-${string}`]: unknown;
};

export type RestPropsDescriptionMultilineProps = Omit<$RestProps, keyof $Props> & $Props;

export type RestPropsDescriptionMultilineExports = Record<string, never>;

declare const RestPropsDescriptionMultiline: Component<
  RestPropsDescriptionMultilineProps,
  RestPropsDescriptionMultilineExports,
  ""
>;
export default RestPropsDescriptionMultiline;
