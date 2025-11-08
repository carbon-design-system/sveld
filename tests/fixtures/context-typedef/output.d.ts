import type { SvelteComponentTyped } from "svelte";

export type TabData = { id: string; label: string; disabled?: boolean };
export type TabsContext = {
  /** Register a new tab */
  addTab: (tab: TabData) => void;
  /** Remove a tab by ID */
  removeTab: (id: string) => void;
};

export type ContextTypedefProps = Record<string, never>;

export default class ContextTypedef extends SvelteComponentTyped<
  ContextTypedefProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
