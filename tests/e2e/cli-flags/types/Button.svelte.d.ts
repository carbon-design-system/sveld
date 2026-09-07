import { SvelteComponentTyped } from "svelte";

export type ButtonProps = {
  /**
   * @default "Click"
   */
  label?: string;

  value: any;

  /**
   * @default "solid"
   */
  variant?: string;
};

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  Record<string, never>
> {}
