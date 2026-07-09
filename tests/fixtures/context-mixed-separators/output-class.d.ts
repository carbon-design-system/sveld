import { SvelteComponentTyped } from "svelte";

export type AppDataTableV2Context = {
  /** Refresh the data */
  refresh: () => void;
  /** Reset the state */
  reset: () => void;
};

export type ContextMixedSeparatorsProps = Record<string, never>;

export default class ContextMixedSeparators extends SvelteComponentTyped<
  ContextMixedSeparatorsProps,
  Record<string, any>,
  Record<string, never>
> {}
