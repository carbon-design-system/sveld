import type { Component } from "svelte";
import type { Snippet } from "svelte";

interface Props {
  row: Snippet<[item: string, index: number]>;
}

type $Props = Props;

export type RunesSnippetPositionalProps = $Props;

export type RunesSnippetPositionalExports = Record<string, never>;

declare const RunesSnippetPositional: Component<
  RunesSnippetPositionalProps,
  RunesSnippetPositionalExports,
  ""
>;
export default RunesSnippetPositional;
