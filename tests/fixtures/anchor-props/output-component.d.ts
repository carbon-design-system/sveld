import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["a"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type AnchorPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export type AnchorPropsExports = Record<string, never>;

declare const AnchorProps: Component<
  AnchorPropsProps,
  AnchorPropsExports,
  ""
>;
export default AnchorProps;
