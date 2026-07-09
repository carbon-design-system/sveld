import type { Component } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default $derived(now.toISOString())
   */
  label?: undefined;
};

export type RunesDerivedPropDefaultExports = Record<string, never>;

declare const RunesDerivedPropDefault: Component<
  RunesDerivedPropDefaultProps,
  RunesDerivedPropDefaultExports,
  ""
>;
export default RunesDerivedPropDefault;
