import type { Component } from "svelte";

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

export type ContextInferredValuesTsExports = Record<string, never>;

declare const ContextInferredValuesTs: Component<
  ContextInferredValuesTsProps,
  ContextInferredValuesTsExports,
  ""
>;
export default ContextInferredValuesTs;
