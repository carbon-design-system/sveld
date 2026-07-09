import type { Component } from "svelte";

export type RunesSnippetsAnnotatedProps = {
  /**
   * @default 0
   */
  prop?: number;

  /** Customize the paragraph text. */
  body?: (this: void, ...args: [{ prop: number }]) => void;

  title?: (this: void) => void;

  children?: (this: void, ...args: [{
        prop: number;
        doubled: number;
      }]) => void;
};

export type RunesSnippetsAnnotatedExports = Record<string, never>;

declare const RunesSnippetsAnnotated: Component<
  RunesSnippetsAnnotatedProps,
  RunesSnippetsAnnotatedExports,
  ""
>;
export default RunesSnippetsAnnotated;
