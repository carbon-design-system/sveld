import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

export interface TimePickerSelectProps extends RestProps {
  /**
   * Specify the select value
   * @default ""
   */
  value?: number | string;

  /**
   * Set to `true` to disable the select
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the ARIA label for the chevron icon
   * @default "Open list of options"
   */
  iconDescription?: string;

  /**
   * Specify the label text
   * @default ""
   */
  labelText?: string;

  /**
   * @deprecated The `hideLabel` prop for `TimePickerSelect` is no longer needed and has been deprecated. It will be removed in the next major release.
   * Set to `false` to show the label text
   * @default true
   */
  hideLabel?: boolean;

  /**
   * Set an id for the select element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Specify a name attribute for the select element
   * @default undefined
   */
  name?: string;

  /**
   * Obtain a reference to the select HTML element
   * @default null
   */
  ref?: null | HTMLSelectElement;

  [key: `data-${string}`]: any;
}

export default class TimePickerSelect extends SvelteComponentTyped<
  TimePickerSelectProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
