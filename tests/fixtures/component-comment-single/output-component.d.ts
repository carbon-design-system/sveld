import type { Component } from "svelte";

export type ComponentCommentSingleProps = {
  children?: (this: void) => void;
};

export type ComponentCommentSingleExports = Record<string, never>;

/** Component comment */
declare const ComponentCommentSingle: Component<
  ComponentCommentSingleProps,
  ComponentCommentSingleExports,
  ""
>;
export default ComponentCommentSingle;
