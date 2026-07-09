import type { Component } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
}

type $Props = Props;

export type RunesPropsAsCastProps = $Props;

export type RunesPropsAsCastExports = Record<string, never>;

declare const RunesPropsAsCast: Component<
  RunesPropsAsCastProps,
  RunesPropsAsCastExports,
  ""
>;
export default RunesPropsAsCast;
