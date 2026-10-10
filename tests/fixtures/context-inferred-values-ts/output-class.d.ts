import { SvelteComponentTyped } from "svelte";

type Item = {
  id: string;
  label: string
};

export type PickerContext = {
  selectedItem: import("svelte/store").Writable<Item | null>;
  items: import("svelte/store").Writable<Item[]>;
  select: (item: Item, focus?: boolean) => void;
};

export type ContextInferredValuesTsProps = {
  children?: (this: void) => void;
};

export default class ContextInferredValuesTs extends SvelteComponentTyped<
  ContextInferredValuesTsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
