import { SvelteComponentTyped } from "svelte";
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

export default class ExtendPropsUnquotedPath extends SvelteComponentTyped<
  ExtendPropsUnquotedPathProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
