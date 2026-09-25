import type { Component } from "svelte";

/**
 * Log a message to the console
 */
export type MyLoggerContext = (message: string) => void;

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
