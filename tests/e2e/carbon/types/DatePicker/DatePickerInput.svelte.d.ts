import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set the size of the input
   * @default undefined
   */
  size?: "sm" | "xl";

  /**
   * Specify the input type
   * @default "text"
   */
  type?: string;

  /**
   * Specify the input placeholder text
   * @default ""
   */
  placeholder?: string;

  /**
   * Specify the Regular Expression for the input value
   * @default "\\d{1,2}\\/\\d{1,2}\\/\\d{4}"
   */
  pattern?: string;

  /**
   * Set to `true` to disable the input
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the ARIA label for the calendar icon
   * @default ""
   */
  iconDescription?: string;

  /**
   * Set an id for the input element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

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
   * Set to `true` to indicate an invalid state
   * @default false
   */
  invalid?: boolean;

  /**
   * Specify the invalid state text
   * @default ""
   */
  invalidText?: string;

  /**
   * Set a name for the input element
   * @default undefined
   */
  name?: string;

  /**
   * Obtain a reference to the input HTML element
   * @default null
   */
  ref?: null | HTMLInputElement;

  [key: `data-${string}`]: any;
};

export type DatePickerInputProps = Omit<$RestProps, keyof $Props> & $Props;

export default class DatePickerInput extends SvelteComponentTyped<
  DatePickerInputProps,
  {
    input: WindowEventMap["input"];
    keydown: WindowEventMap["keydown"];
    blur: WindowEventMap["blur"];
  },
  {}
> {}
