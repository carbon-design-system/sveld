import type { Component } from "svelte";

interface Item {
  id: string;
}

export type MenuContext = {
  count: number;
  label: string;
  open: boolean;
  items: Item[];
  selected: string | null;
  doubled: number;
  offset: number;
};

export type TotalContext = number;

export type ContextRunesStateProps = {
  children?: (this: void) => void;
};

export type ContextRunesStateExports = Record<string, never>;

declare const ContextRunesState: Component<
  ContextRunesStateProps,
  ContextRunesStateExports,
  ""
>;
export default ContextRunesState;
