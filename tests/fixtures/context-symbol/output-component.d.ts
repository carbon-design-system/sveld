import type { Component } from "svelte";

export type TabsContext = {
  /** The currently active tab index. */
  activeTab: number;
  /** Register a tab and return its index. */
  registerTab: (label: string) => number;
};

export type ContextSymbolProps = {
  children?: (this: void) => void;
};

export type ContextSymbolExports = Record<string, never>;

declare const ContextSymbol: Component<
  ContextSymbolProps,
  ContextSymbolExports,
  ""
>;
export default ContextSymbol;
