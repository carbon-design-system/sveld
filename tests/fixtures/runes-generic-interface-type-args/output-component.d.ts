import type { Component } from "svelte";

interface Props<T> {
  value: T;
  onchange?: (T: T) => void;
  kind?: "T" | T;
  map?: {
    T: T;
    readonly label: T
  };
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
