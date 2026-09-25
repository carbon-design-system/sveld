import { SvelteComponentTyped } from "svelte";

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

export default class ContextRunesState extends SvelteComponentTyped<
  ContextRunesStateProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
