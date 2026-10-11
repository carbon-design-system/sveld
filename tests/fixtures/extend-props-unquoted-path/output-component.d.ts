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

export type ExtendPropsUnquotedPathProps = Omit<$RestProps, keyof ($Props & ButtonProps)> & Omit<ButtonProps, keyof $Props> & $Props;

export type ExtendPropsUnquotedPathExports = Record<string, never>;

declare const ExtendPropsUnquotedPath: Component<
  ExtendPropsUnquotedPathProps,
  ExtendPropsUnquotedPathExports,
  ""
>;
export default ExtendPropsUnquotedPath;
