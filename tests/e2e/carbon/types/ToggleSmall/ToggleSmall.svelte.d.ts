import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set to `true` to toggle the checkbox input
   * @default false
   */
  toggled?: boolean;

  /**
   * Set to `true` to disable checkbox input
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the label for the untoggled state
   * @default "Off"
   */
  labelA?: string;

  /**
   * Specify the label for the toggled state
   * @default "On"
   */
  labelB?: string;

  /**
   * Specify the label text
   * @default ""
   */
  labelText?: string;

  /**
   * Set an id for the input element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Specify a name attribute for the checkbox input
   * @default undefined
   */
  name?: string;

  [key: `data-${string}`]: any;
};

export type ToggleSmallProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ToggleSmall extends SvelteComponentTyped<
  ToggleSmallProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    change: WindowEventMap["change"];
    keyup: WindowEventMap["keyup"];
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
  },
  {}
> {}
