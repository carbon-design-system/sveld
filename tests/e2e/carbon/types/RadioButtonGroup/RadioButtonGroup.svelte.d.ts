import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type RadioButtonGroupContext = {
  selectedValue: any;
  add: (arg: any) => any;
  update: (value: any) => any;
};

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set the selected radio button value
   * @default undefined
   */
  selected?: string;

  /**
   * Set to `true` to disable the radio buttons
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the label position
   * @default "right"
   */
  labelPosition?: "right" | "left";

  /**
   * Specify the orientation of the radio buttons
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";

  /**
   * Set an id for the container div element
   * @default undefined
   */
  id?: string;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RadioButtonGroupProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RadioButtonGroup extends SvelteComponentTyped<
  RadioButtonGroupProps,
  {
    change: CustomEvent<any>;
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
