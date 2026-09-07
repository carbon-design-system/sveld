import type { Component } from "svelte";

export type RunesPropsBasicProps = {
  title: any;

  /**
   * @default 0
   */
  count?: number;
};

export type RunesPropsBasicExports = Record<string, never>;

declare const RunesPropsBasic: Component<
  RunesPropsBasicProps,
  RunesPropsBasicExports,
  ""
>;
export default RunesPropsBasic;
