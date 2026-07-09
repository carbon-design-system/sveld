import type { Component } from "svelte";

export type NotificationContext = {
  /** Push a notification message. */
  notify: (message: string) => void;
};

export type ContextSymbolForProps = {
  children?: (this: void) => void;
};

export type ContextSymbolForExports = Record<string, never>;

declare const ContextSymbolFor: Component<
  ContextSymbolForProps,
  ContextSymbolForExports,
  ""
>;
export default ContextSymbolFor;
