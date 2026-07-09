import type { Component } from "svelte";

interface Props<T> {
  value: T;
  onchange?: (v: T) => void;
}

type $Props = Props<string>;

export type RunesGenericInterfaceTypeArgsProps = $Props;

export type RunesGenericInterfaceTypeArgsExports = Record<string, never>;

declare const RunesGenericInterfaceTypeArgs: Component<
  RunesGenericInterfaceTypeArgsProps,
  RunesGenericInterfaceTypeArgsExports,
  ""
>;
export default RunesGenericInterfaceTypeArgs;
