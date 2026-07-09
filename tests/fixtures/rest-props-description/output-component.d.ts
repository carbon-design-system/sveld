import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

/** Spread to the span (inline variant) or the copy button (single/multi). */
type $RestProps = SvelteHTMLElements["button"] & SvelteHTMLElements["span"];

type $Props = {
  /**
   * @default "single"
   */
  variant?: "inline" | "single" | "multi";

  [key: `data-${string}`]: unknown;
};

export type RestPropsDescriptionProps = Omit<$RestProps, keyof $Props> & $Props;

export type RestPropsDescriptionExports = Record<string, never>;

declare const RestPropsDescription: Component<
  RestPropsDescriptionProps,
  RestPropsDescriptionExports,
  ""
>;
export default RestPropsDescription;
