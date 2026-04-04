import { SvelteComponentTyped, type Snippet } from "svelte";

export type RunesSnippetPositionalProps = {
  /**
   * @default undefined
   */
  row: Snippet<[item: string, index: number]>;
};

export default class RunesSnippetPositional extends SvelteComponentTyped<
  RunesSnippetPositionalProps,
  Record<string, any>,
  Record<string, never>
> {}
