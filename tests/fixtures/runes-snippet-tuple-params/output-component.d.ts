import type { Component } from "svelte";

export type RunesSnippetTupleParamsProps = {
  /** Below the list. */
  footer?: (this: void, ...args: [{ count: number }]) => void;

  /** One row per item. */
  row?: (this: void, ...args: [item: string, index: number]) => void;
};

export type RunesSnippetTupleParamsExports = Record<string, never>;

declare const RunesSnippetTupleParams: Component<
  RunesSnippetTupleParamsProps,
  RunesSnippetTupleParamsExports,
  ""
>;
export default RunesSnippetTupleParams;
