import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default undefined
   */
  variant: undefined;

  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesRestPropsExports = Record<string, never>;

declare const RunesRestProps: Component<
  RunesRestPropsProps,
  RunesRestPropsExports,
  ""
>;
export default RunesRestProps;
