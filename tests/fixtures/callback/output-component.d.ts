import type { Component } from "svelte";

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

export type CallbackExports = Record<string, never>;

declare const Callback: Component<
  CallbackProps,
  CallbackExports,
  ""
>;
export default Callback;
