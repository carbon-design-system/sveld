import type { Component } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
}

type $Props = Props;

export type RunesPropsSatisfiesCastProps = $Props;

export type RunesPropsSatisfiesCastExports = Record<string, never>;

declare const RunesPropsSatisfiesCast: Component<
  RunesPropsSatisfiesCastProps,
  RunesPropsSatisfiesCastExports,
  ""
>;
export default RunesPropsSatisfiesCast;
