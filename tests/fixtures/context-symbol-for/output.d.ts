import { SvelteComponentTyped } from "svelte";

export type NotificationContext = {
  /** Push a notification message. */
  notify: (message: string) => void;
};

export type ContextSymbolForProps = {
  children?: (this: void) => void;
};

export default class ContextSymbolFor extends SvelteComponentTyped<
  ContextSymbolForProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
