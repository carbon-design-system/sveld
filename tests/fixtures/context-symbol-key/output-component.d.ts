import type { Component } from "svelte";

export type TabsContext = {
  /** The currently active tab index. */
  activeTab: number;
  /** Register a tab and return its index. */
  registerTab: (label: string) => number;
};

export type NotificationContext = {
  /** Push a notification message. */
  notify: (message: string) => void;
};

export type ModalKeyContext = {
  /** Push a notification message. */
  notify: (message: string) => void;
};

export type ContextSymbolKeyProps = {
  children?: (this: void) => void;
};

export type ContextSymbolKeyExports = Record<string, never>;

declare const ContextSymbolKey: Component<
  ContextSymbolKeyProps,
  ContextSymbolKeyExports,
  ""
>;
export default ContextSymbolKey;
