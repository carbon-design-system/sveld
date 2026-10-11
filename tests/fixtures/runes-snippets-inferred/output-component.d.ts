import type { Component } from "svelte";

export type RunesSnippetsInferredProps = {
  item: any;

  header?: (this: void, ...args: [{ title: any }]) => void;

  children?: (this: void, ...args: [{ item: any }]) => void;
};

export type RunesSnippetsInferredExports = Record<string, never>;

declare const RunesSnippetsInferred: Component<
  RunesSnippetsInferredProps,
  RunesSnippetsInferredExports,
  ""
>;
export default RunesSnippetsInferred;
