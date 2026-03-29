import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default undefined
   */
  label: undefined;

  /**
   * @default undefined
   */
  onclick: undefined;

  /**
   * @default "ready"
   */
  value?: string;

  /**
   * @default undefined
   */
  onpress: undefined;

  children?: (this: void, ...args: [{ value: string }]) => void;

  [key: `data-${string}`]: unknown;
};

export type RunesButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RunesButton extends SvelteComponentTyped<
  RunesButtonProps,
  Record<string, any>,
  { default: { value: string } }
> {}
