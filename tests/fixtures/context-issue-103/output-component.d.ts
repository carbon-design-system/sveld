import type { Component } from "svelte";

export type MyLoggerContext = {
  /** Log a message to the console */
  log: (message: string) => void;
};

export type ContextIssue103Props = {
  children?: (this: void) => void;
};

export type ContextIssue103Exports = Record<string, never>;

declare const ContextIssue103: Component<
  ContextIssue103Props,
  ContextIssue103Exports,
  ""
>;
export default ContextIssue103;
