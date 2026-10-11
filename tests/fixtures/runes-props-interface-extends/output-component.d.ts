import type { Component } from "svelte";

interface Identified<Id> {
  /** Unique id. */
  id: Id;
  /** Shown when `label` is empty. */
  fallback?: string;
}

interface Labeled {
  label?: string;
}

interface Props extends Identified<number>, Labeled {
  /** Overrides the inherited docs. */
  fallback?: string;
}

type $Props = Props;

export type RunesPropsInterfaceExtendsProps = $Props;

export type RunesPropsInterfaceExtendsExports = Record<string, never>;

declare const RunesPropsInterfaceExtends: Component<
  RunesPropsInterfaceExtendsProps,
  RunesPropsInterfaceExtendsExports,
  ""
>;
export default RunesPropsInterfaceExtends;
