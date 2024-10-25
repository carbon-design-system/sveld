import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Specify the value of the radio button
   * @default ""
   */
  value?: string;

  /**
   * Set to `true` to check the radio button
   * @default false
   */
  checked?: boolean;

  /**
   * et to `true` to disable the radio button
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the label position
   * @default "right"
   */
  labelPosition?: "right" | "left";

  /**
   * Specify the label text
   * @default ""
   */
  labelText?: string;

  /**
   * Set to `true` to visually hide the label text
   * @default false
   */
  hideLabel?: boolean;

  /**
   * Set an id for the input element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Specify a name attribute for the checkbox input
   * @default ""
   */
  name?: string;

  /**
   * Obtain a reference to the input HTML element
   * @default null
   */
  ref?: null | HTMLInputElement;

  [key: `data-${string}`]: any;
};

export type RadioButtonProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class RadioButton extends SvelteComponentTyped<
  RadioButtonProps,
  { change: WindowEventMap["change"] },
  {}
> {}
