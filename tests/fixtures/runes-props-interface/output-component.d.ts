import type { Component } from "svelte";

interface Props {
  foo: string;
  bar?: number;
}

type $Props = Props;

export type RunesPropsInterfaceProps = $Props;

export type RunesPropsInterfaceExports = Record<string, never>;

declare const RunesPropsInterface: Component<
  RunesPropsInterfaceProps,
  RunesPropsInterfaceExports,
  ""
>;
export default RunesPropsInterface;
