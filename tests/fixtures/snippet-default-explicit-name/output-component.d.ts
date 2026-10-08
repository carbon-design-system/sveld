import type { Component } from "svelte";

export type SnippetDefaultExplicitNameProps = {
  /** Body content. */
  children?: (this: void) => void;
};

export type SnippetDefaultExplicitNameExports = Record<string, never>;

declare const SnippetDefaultExplicitName: Component<
  SnippetDefaultExplicitNameProps,
  SnippetDefaultExplicitNameExports,
  ""
>;
export default SnippetDefaultExplicitName;
