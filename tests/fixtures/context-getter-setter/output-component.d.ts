import type { Component } from "svelte";

export type CounterContext = {
  /** Current count */
  count: number;
  label: string;
  step: number;
};

export type ContextGetterSetterProps = Record<string, never>;

export type ContextGetterSetterExports = Record<string, never>;

declare const ContextGetterSetter: Component<
  ContextGetterSetterProps,
  ContextGetterSetterExports,
  ""
>;
export default ContextGetterSetter;
