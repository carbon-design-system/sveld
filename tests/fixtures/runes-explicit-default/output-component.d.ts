import type { Component } from "svelte";

export type RunesExplicitDefaultProps = {
  /**
   * Element id.
   * @default A generated `ccs-` id
   */
  id?: any;

  /**
   * @default 5
   */
  retries?: number;
};

export type RunesExplicitDefaultExports = Record<string, never>;

declare const RunesExplicitDefault: Component<
  RunesExplicitDefaultProps,
  RunesExplicitDefaultExports,
  ""
>;
export default RunesExplicitDefault;
