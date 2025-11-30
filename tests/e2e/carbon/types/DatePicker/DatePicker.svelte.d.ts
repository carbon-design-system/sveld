import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type DatePickerContext = {
  range: any;
  inputValue: any;
  hasCalendar: any;
  add: (data: any) => any;
  declareRef: (arg: any) => any;
  updateValue: (arg: any) => any;
  blurInput: (relatedTarget: any) => any;
  openCalendar: () => any;
  focusCalendar: () => any;
};

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the date picker type
   * @default "simple"
   */
  datePickerType?: "simple" | "single" | "range";

  /**
   * Specify the date picker input value
   * @default ""
   */
  value?: number | string;

  /**
   * Specify the element to append the calendar to
   * @default document.body
   */
  appendTo?: HTMLElement;

  /**
   * Specify the date format
   * @default "m/d/Y"
   */
  dateFormat?: string;

  /**
   * Specify the maximum date
   * @default null
   */
  maxDate?: null | string | Date;

  /**
   * Specify the minimum date
   * @default null
   */
  minDate?: null | string | Date;

  /**
   * Specify the locale
   * @default "en"
   */
  locale?: string;

  /**
   * Set to `true` to use the short variant
   * @default false
   */
  short?: boolean;

  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  /**
   * Set an id for the date picker element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  [key: `data-${string}`]: any;
};

export type DatePickerProps = Omit<$RestProps, keyof $Props> & $Props;

export default class DatePicker extends SvelteComponentTyped<
  DatePickerProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    change: CustomEvent<any>;
  },
  { default: Record<string, never> }
> {}
