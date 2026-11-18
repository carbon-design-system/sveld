import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { Snippet } from "svelte";

type $RestProps = SvelteHTMLElements["div"];

type $Props = ({
    onclick: () => void;
    children?: Snippet;
  }) & {
  [key: `data-${string}`]: unknown;
};

export type RunesSnippetGenericArrowConstraintProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesSnippetGenericArrowConstraintExports = Record<string, never>;

declare const RunesSnippetGenericArrowConstraint: Component<
  RunesSnippetGenericArrowConstraintProps,
  RunesSnippetGenericArrowConstraintExports,
  ""
>;
export default RunesSnippetGenericArrowConstraint;
