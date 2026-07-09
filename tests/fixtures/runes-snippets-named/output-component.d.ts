import type { Component } from "svelte";

export type RunesSnippetsNamedProps = {
  /**
   * @default undefined
   */
  item: undefined;

  header?: (this: void, ...args: [{ title: any }]) => void;
};

export type RunesSnippetsNamedExports = Record<string, never>;

declare const RunesSnippetsNamed: Component<
  RunesSnippetsNamedProps,
  RunesSnippetsNamedExports,
  ""
>;
export default RunesSnippetsNamed;
