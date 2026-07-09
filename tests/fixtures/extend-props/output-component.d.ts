import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { ButtonProps } from "./Button.svelte";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default false
   */
  secondary?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type ExtendPropsProps = Omit<$RestProps, keyof ($Props & ButtonProps)> & $Props & ButtonProps;

export type ExtendPropsExports = Record<string, never>;

declare const ExtendProps: Component<
  ExtendPropsProps,
  ExtendPropsExports,
  ""
>;
export default ExtendProps;
