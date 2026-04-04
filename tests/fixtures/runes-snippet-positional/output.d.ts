import { SvelteComponentTyped } from "svelte";
import type { Snippet } from "svelte";

interface Props {
  row: Snippet<[item: string, index: number]>;
}

type $Props = Props;

export type RunesSnippetPositionalProps = $Props;

export default class RunesSnippetPositional extends SvelteComponentTyped<
  RunesSnippetPositionalProps,
  Record<string, any>,
  Record<string, never>
> {}
