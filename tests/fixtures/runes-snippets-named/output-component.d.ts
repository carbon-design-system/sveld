import type { Component } from "svelte";

export type RunesSnippetsNamedProps = {
  item: any;

  header?: (this: void, ...args: [{ title: any }]) => void;
};

export type RunesSnippetsNamedExports = Record<string, never>;

declare const RunesSnippetsNamed: Component<
  RunesSnippetsNamedProps,
  RunesSnippetsNamedExports,
  ""
>;
export default RunesSnippetsNamed;
