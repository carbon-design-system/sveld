import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "md"
   */
  size?: "sm" | "md";

  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsThroughDerivedProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesRestPropsThroughDerivedExports = Record<string, never>;

declare const RunesRestPropsThroughDerived: Component<
  RunesRestPropsThroughDerivedProps,
  RunesRestPropsThroughDerivedExports,
  ""
>;
export default RunesRestPropsThroughDerived;
