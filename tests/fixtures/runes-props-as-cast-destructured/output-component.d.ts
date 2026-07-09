import type { Component } from "svelte";

type $Props = {
  value: number;
  label?: string
};

export type RunesPropsAsCastDestructuredProps = $Props;

export type RunesPropsAsCastDestructuredExports = Record<string, never>;

declare const RunesPropsAsCastDestructured: Component<
  RunesPropsAsCastDestructuredProps,
  RunesPropsAsCastDestructuredExports,
  ""
>;
export default RunesPropsAsCastDestructured;
