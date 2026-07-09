import type { Component } from "svelte";

export type AppDataTableV2Context = {
  /** Refresh the data */
  refresh: () => void;
  /** Reset the state */
  reset: () => void;
};

export type ContextMixedSeparatorsProps = Record<string, never>;

export type ContextMixedSeparatorsExports = Record<string, never>;

declare const ContextMixedSeparators: Component<
  ContextMixedSeparatorsProps,
  ContextMixedSeparatorsExports,
  ""
>;
export default ContextMixedSeparators;
