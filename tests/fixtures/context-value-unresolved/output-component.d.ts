import type { Component } from "svelte";

export type StoreContext = import("svelte/store").Writable<number>;

export type ContextValueUnresolvedProps = {
  children?: (this: void) => void;
};

export type ContextValueUnresolvedExports = Record<string, never>;

declare const ContextValueUnresolved: Component<
  ContextValueUnresolvedProps,
  ContextValueUnresolvedExports,
  ""
>;
export default ContextValueUnresolved;
