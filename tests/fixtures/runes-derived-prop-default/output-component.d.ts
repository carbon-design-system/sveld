import type { Component } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default $derived(now.toISOString())
   */
  label?: any;

  /**
   * @default $derived(uniqueId())
   */
  theId?: string;

  /**
   * @default $state(0)
   */
  theCount?: number;
};

export type RunesDerivedPropDefaultExports = Record<string, never>;

declare const RunesDerivedPropDefault: Component<
  RunesDerivedPropDefaultProps,
  RunesDerivedPropDefaultExports,
  ""
>;
export default RunesDerivedPropDefault;
