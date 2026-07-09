import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["ul"] & SvelteHTMLElements["ol"];

type $Props = {
  /**
   * @default "ordered"
   */
  type?: "ordered" | "unordered";

  [key: `data-${string}`]: unknown;
};

export type RestPropsMultipleProps = Omit<$RestProps, keyof $Props> & $Props;

export type RestPropsMultipleExports = Record<string, never>;

declare const RestPropsMultiple: Component<
  RestPropsMultipleProps,
  RestPropsMultipleExports,
  ""
>;
export default RestPropsMultiple;
