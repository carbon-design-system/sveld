import { SvelteComponentTyped } from "svelte";

/**
 * Log a message to the console
 */
export type MyLoggerContext = (message: string) => void;

export type ContextIssue103Props = {
  children?: (this: void) => void;
};

export default class ContextIssue103 extends SvelteComponentTyped<
  ContextIssue103Props,
  Record<string, any>,
  { default: Record<string, never> }
> {}
