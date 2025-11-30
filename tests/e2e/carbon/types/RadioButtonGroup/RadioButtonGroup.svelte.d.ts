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

  [key: `data-${string}`]: any;
};

export type RadioButtonGroupProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RadioButtonGroup extends SvelteComponentTyped<
  RadioButtonGroupProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    change: CustomEvent<any>;
  },
  { default: Record<string, never> }
> {}
