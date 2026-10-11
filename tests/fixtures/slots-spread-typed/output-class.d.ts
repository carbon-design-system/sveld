import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadTypedProps = {
  /**
   * @default ""
   */
  iconStyle?: string;

  icon?: (this: void, ...args: [{ style: string }]) => void;

  text?: (this: void, ...args: [{ a: number }]) => void;

  children?: (this: void, ...args: [{ a: number }]) => void;
};

export default class SlotsSpreadTyped extends SvelteComponentTyped<
  SlotsSpreadTypedProps,
  Record<string, any>,
  {
    default: { a: number };
    icon: { style: string };
    text: { a: number };
  }
> {}
