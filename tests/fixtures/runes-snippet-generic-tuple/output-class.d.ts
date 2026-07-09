import { SvelteComponentTyped } from "svelte";
import type { Snippet } from "svelte";

type $Props<Row> = {
  rows: Row[];
  children: Snippet<[row: Row, index: number]>;
};

export type RunesSnippetGenericTupleProps<Row> = $Props<Row>;

export default class RunesSnippetGenericTuple<Row> extends SvelteComponentTyped<
  RunesSnippetGenericTupleProps<Row>,
  Record<string, any>,
  Record<string, never>
> {}
