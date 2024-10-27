import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Set the feedback text shown after clicking the button
   * @default "Copied!"
   */
  feedback?: string;

  /**
   * Set the timeout duration (ms) to display feedback text
   * @default 2000
   */
  feedbackTimeout?: number;

  /**
   * Obtain a reference to the button HTML element
   * @default null
   */
  ref?: null | HTMLButtonElement;

  [key: `data-${string}`]: any;
};

export type CopyProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Copy extends SvelteComponentTyped<
  CopyProps,
  {
    click: WindowEventMap["click"];
    animationend: WindowEventMap["animationend"];
  },
  { default: {} }
> {}
