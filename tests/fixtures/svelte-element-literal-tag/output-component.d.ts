import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type SvelteElementLiteralTagProps = Omit<$RestProps, keyof $Props> & $Props;

export type SvelteElementLiteralTagExports = Record<string, never>;

declare const SvelteElementLiteralTag: Component<
  SvelteElementLiteralTagProps,
  SvelteElementLiteralTagExports,
  ""
>;
export default SvelteElementLiteralTag;
