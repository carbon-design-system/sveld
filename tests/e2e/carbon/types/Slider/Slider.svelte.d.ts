import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the value of the slider
   * @default 0
   */
  value?: number;

  /**
   * Set the maximum slider value
   * @default 100
   */
  max?: number;

  /**
   * Specify the label for the max value
   * @default ""
   */
  maxLabel?: string;

  /**
   * Set the minimum slider value
   * @default 0
   */
  min?: number;

  /**
   * Specify the label for the min value
   * @default ""
   */
  minLabel?: string;

  /**
   * Set the step value
   * @default 1
   */
  step?: number;

  /**
   * Set the step multiplier value
   * @default 4
   */
  stepMultiplier?: number;

  /**
   * Set to `true` to require a value
   * @default false
   */
  required?: boolean;

  /**
   * Specify the input type
   * @default "number"
   */
  inputType?: string;

  /**
   * Set to `true` to disable the slider
   * @default false
   */
  disabled?: boolean;

  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  /**
   * Set to `true` to hide the text input
   * @default false
   */
  hideTextInput?: boolean;

  /**
   * Set an id for the slider div element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Set to `true` to indicate an invalid state
   * @default false
   */
  invalid?: boolean;

  /**
   * Specify the label text
   * @default ""
   */
  labelText?: string;

  /**
   * Set a name for the slider element
   * @default ""
   */
  name?: string;

  /**
   * Obtain a reference to the HTML element
   * @default null
   */
  ref?: null | HTMLDivElement;

  [key: `data-${string}`]: any;
};

export type SliderProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Slider extends SvelteComponentTyped<
  SliderProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    change: CustomEvent<any>;
  },
  {}
> {}
