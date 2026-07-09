import type { Component } from "svelte";

export type RunesSnippetsDefaultProps = {
  /**
   * @default undefined
   */
  item: undefined;

  children?: (this: void, ...args: [{ item: any }]) => void;
};

export type RunesSnippetsDefaultExports = Record<string, never>;

declare const RunesSnippetsDefault: Component<
  RunesSnippetsDefaultProps,
  RunesSnippetsDefaultExports,
  ""
>;
export default RunesSnippetsDefault;
