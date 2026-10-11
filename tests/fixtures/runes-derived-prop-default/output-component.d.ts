import type { Component } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default now.toISOString()
   */
  label?: any;

  /**
   * @default uniqueId()
   */
  theId?: string;

  /**
   * @default 0
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
