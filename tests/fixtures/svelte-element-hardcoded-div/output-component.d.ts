import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type SvelteElementHardcodedDivProps = Omit<$RestProps, keyof $Props> & $Props;

export type SvelteElementHardcodedDivExports = Record<string, never>;

declare const SvelteElementHardcodedDiv: Component<
  SvelteElementHardcodedDivProps,
  SvelteElementHardcodedDivExports,
  ""
>;
export default SvelteElementHardcodedDiv;
