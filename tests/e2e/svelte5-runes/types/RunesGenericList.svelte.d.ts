import { SvelteComponentTyped } from "svelte";
import type { Snippet } from "svelte";

type $Props<Item extends { id: string | number } = { id: string }> = {
  items: Item[];
  row: Snippet<[item: Item]>;
};

export type RunesGenericListProps<
  Item extends { id: string | number } = { id: string },
> = $Props<Item>;

export default class RunesGenericList<
  Item extends { id: string | number } = { id: string },
> extends SvelteComponentTyped<
  RunesGenericListProps<Item>,
  Record<string, any>,
  Record<string, never>
> {}
