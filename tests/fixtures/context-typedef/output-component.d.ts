import type { Component } from "svelte";

export type TabData = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type TabsContext = {
  /** Register a new tab */
  addTab: (tab: TabData) => void;
  /** Remove a tab by ID */
  removeTab: (id: string) => void;
};

export type ContextTypedefProps = {
  children?: (this: void) => void;
};

export type ContextTypedefExports = Record<string, never>;

declare const ContextTypedef: Component<
  ContextTypedefProps,
  ContextTypedefExports,
  ""
>;
export default ContextTypedef;
