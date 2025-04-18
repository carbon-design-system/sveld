import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["fieldset"];

type $Props = {
  /**
   * Set to `true` to indicate an invalid state
   * @default false
   */
  invalid?: boolean;

  /**
   * Set to `true` to render a form requirement
   * @default false
   */
  message?: boolean;

  /**
   * Specify the message text
   * @default ""
   */
  messageText?: string;

  /**
   * Specify the legend text
   * @default ""
   */
  legendText?: string;

  [key: `data-${string}`]: any;
};

export type FormGroupProps = Omit<$RestProps, keyof $Props> & $Props;

export default class FormGroup extends SvelteComponentTyped<
  FormGroupProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
