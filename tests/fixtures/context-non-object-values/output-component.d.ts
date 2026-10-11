import type { Component } from "svelte";

export type CountContext = import("svelte/store").Writable<number>;

export type LevelContext = import("svelte/store").Readable<number>;

export type ParentContext = undefined;

export type GroupContext = null;

export type ContextNonObjectValuesProps = {
  children?: (this: void) => void;
};

export type ContextNonObjectValuesExports = Record<string, never>;

declare const ContextNonObjectValues: Component<
  ContextNonObjectValuesProps,
  ContextNonObjectValuesExports,
  ""
>;
export default ContextNonObjectValues;
