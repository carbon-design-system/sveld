import { SvelteComponentTyped } from "svelte";

export type TabsContext = {
  /** The currently active tab index. */
  activeTab: number;
  /** Register a tab and return its index. */
  registerTab: (label: string) => number;
};

export type ContextSymbolProps = {
  children?: (this: void) => void;
};

export default class ContextSymbol extends SvelteComponentTyped<
  ContextSymbolProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
