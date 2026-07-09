import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["h1"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type RestPropsSimpleProps = Omit<$RestProps, keyof $Props> & $Props;

export type RestPropsSimpleExports = Record<string, never>;

declare const RestPropsSimple: Component<
  RestPropsSimpleProps,
  RestPropsSimpleExports,
  ""
>;
export default RestPropsSimple;
