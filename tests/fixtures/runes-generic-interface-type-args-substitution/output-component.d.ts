import type { Component } from "svelte";

interface Props<T, U extends unknown[], F> {
  values: T[];
  tuple: [...U, T];
  label: `T-${T & string}`;
  callback: F | null;
}

type $Props = Props<"a" | "b", [number], () => void>;

export type RunesGenericInterfaceTypeArgsSubstitutionProps = $Props;

export type RunesGenericInterfaceTypeArgsSubstitutionExports = Record<string, never>;

declare const RunesGenericInterfaceTypeArgsSubstitution: Component<
  RunesGenericInterfaceTypeArgsSubstitutionProps,
  RunesGenericInterfaceTypeArgsSubstitutionExports,
  ""
>;
export default RunesGenericInterfaceTypeArgsSubstitution;
