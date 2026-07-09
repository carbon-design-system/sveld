import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["svg"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type SvgPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export type SvgPropsExports = Record<string, never>;

declare const SvgProps: Component<
  SvgPropsProps,
  SvgPropsExports,
  ""
>;
export default SvgProps;
