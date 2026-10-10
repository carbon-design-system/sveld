import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "sm"
   */
  size?: "sm" | "md";

  label: string;

  [key: `data-${string}`]: unknown;
};

export type RunesJsdocPropsIndexSignatureProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesJsdocPropsIndexSignatureExports = Record<string, never>;

declare const RunesJsdocPropsIndexSignature: Component<
  RunesJsdocPropsIndexSignatureProps,
  RunesJsdocPropsIndexSignatureExports,
  ""
>;
export default RunesJsdocPropsIndexSignature;
