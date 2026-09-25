import { SvelteComponentTyped } from "svelte";

export type AbortContext = AbortController;

export type SelectedContext<Item> = Item[];

export type SettingsContext = {
  dense: boolean;
  label?: string;
};

export type ApiContext = {
  reset: () => any;
  version: string;
};

export type StoreContext = any;

export type ContextVariableValueProps<Item> = {
  children?: (this: void) => void;
};

export default class ContextVariableValue<Item> extends SvelteComponentTyped<
  ContextVariableValueProps<Item>,
  Record<string, any>,
  { default: Record<string, never> }
> {}
