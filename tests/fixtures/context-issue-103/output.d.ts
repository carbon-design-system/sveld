import { SvelteComponentTyped } from "svelte";

export type MyLoggerContext = {
  /** Log a message to the console */
  log: (message: string) => void;
};

export type ContextIssue103Props = {
  children?: (this: void) => void;
};

export default class ContextIssue103 extends SvelteComponentTyped<
  ContextIssue103Props,
  Record<string, any>,
  { default: Record<string, never> }
> {}
