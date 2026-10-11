import { SvelteComponentTyped } from "svelte";

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

export default class ContextSymbolKey extends SvelteComponentTyped<
  ContextSymbolKeyProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
