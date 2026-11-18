import { SvelteComponentTyped } from "svelte";
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

export default class RunesSnippetGenericArrowConstraint extends SvelteComponentTyped<
  RunesSnippetGenericArrowConstraintProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
