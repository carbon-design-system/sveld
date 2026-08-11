import type { Component } from "svelte";

export type RunesDerivedPropDefaultResolvedProps = {
  /**
   * @default $derived(uniqueId())
   */
  theId?: string;

  /**
   * @default $state(0)
   */
  theCount?: number;
};

export type RunesDerivedPropDefaultResolvedExports = Record<string, never>;

declare const RunesDerivedPropDefaultResolved: Component<
  RunesDerivedPropDefaultResolvedProps,
  RunesDerivedPropDefaultResolvedExports,
  ""
>;
export default RunesDerivedPropDefaultResolved;
