import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type SvelteElementHardcodedButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export type SvelteElementHardcodedButtonExports = Record<string, never>;

declare const SvelteElementHardcodedButton: Component<
  SvelteElementHardcodedButtonProps,
  SvelteElementHardcodedButtonExports,
  ""
>;
export default SvelteElementHardcodedButton;
