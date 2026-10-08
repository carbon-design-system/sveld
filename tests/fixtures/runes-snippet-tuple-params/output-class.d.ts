import { SvelteComponentTyped } from "svelte";

export type RunesSnippetTupleParamsProps = {
  /** Below the list. */
  footer?: (this: void, ...args: [{ count: number }]) => void;

  /** One row per item. */
  row?: (this: void, ...args: [item: string, index: number]) => void;
};

export default class RunesSnippetTupleParams extends SvelteComponentTyped<
  RunesSnippetTupleParamsProps,
  Record<string, any>,
  {
    /** Below the list. */
    footer: { count: number };
  }
> {}
