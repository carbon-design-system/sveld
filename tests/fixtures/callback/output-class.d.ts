import { SvelteComponentTyped } from "svelte";

/**
 * Callback fired when the value changes.
 */
export type OnChange = (value: string, index: number) => void;

export type Comparator = (a: any, b: any) => number;

/**
 * No-arg callback.
 */
export type OnClose = () => void;

export type CallbackProps = {
  /**
   * Callback fired when the value changes.
   * @default (value, index) => {}
   */
  onChange?: OnChange;

  /**
   * @default (a, b) => a - b
   */
  comparator?: Comparator;

  /**
   * No-arg callback.
   * @default () => {}
   */
  onClose?: OnClose;
};

export default class Callback extends SvelteComponentTyped<CallbackProps, Record<string, any>, Record<string, never>> {}
