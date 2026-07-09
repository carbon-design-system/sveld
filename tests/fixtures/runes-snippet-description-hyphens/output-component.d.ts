import type { Component } from "svelte";

export type RunesSnippetDescriptionHyphensProps = {
  /**
   * @default undefined
   */
  row: undefined;

  /**
   * @default undefined
   */
  col: undefined;

  /**
   * First line documents `row-id` binding.
   * Second line: column-id and drag-and-drop targets share one surface.
   */
  children?: (this: void, ...args: [{
        row: string;
        col: string
      }]) => void;
};

export type RunesSnippetDescriptionHyphensExports = Record<string, never>;

declare const RunesSnippetDescriptionHyphens: Component<
  RunesSnippetDescriptionHyphensProps,
  RunesSnippetDescriptionHyphensExports,
  ""
>;
export default RunesSnippetDescriptionHyphens;
