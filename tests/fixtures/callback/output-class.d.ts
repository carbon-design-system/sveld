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
   */
  onChange?: OnChange;

  comparator?: Comparator;

  /**
   * No-arg callback.
   */
  onClose?: OnClose;
};

export default class Callback extends SvelteComponentTyped<CallbackProps, Record<string, any>, Record<string, never>> {}
