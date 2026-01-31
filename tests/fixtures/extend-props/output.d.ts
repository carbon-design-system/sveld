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

  [key: `data-${string}`]: any;
};

export type ExtendPropsProps = Omit<$RestProps, keyof ($Props & ButtonProps)> & $Props & ButtonProps;

export default class ExtendProps extends SvelteComponentTyped<
  ExtendPropsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
