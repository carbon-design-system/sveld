import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the toggle size
   * @default "default"
   */
  size?: "default" | "sm";

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
   * @default `ccs-${Math.random().toString(36)}`
   */
  id?: string;

  /**
   * Specify a name attribute for the checkbox input
   * @default undefined
   */
  name?: string;

  [key: `data-${string}`]: unknown;
};

export type ToggleProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Toggle extends SvelteComponentTyped<
  ToggleProps,
  {
    blur: WindowEventMap["blur"];
    change: WindowEventMap["change"];
    click: WindowEventMap["click"];
    focus: WindowEventMap["focus"];
    keyup: WindowEventMap["keyup"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
    toggle: CustomEvent<{ toggled: boolean }>;
  },
  Record<string, never>
> {}
