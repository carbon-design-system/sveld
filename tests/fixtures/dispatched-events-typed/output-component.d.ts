import type { Component } from "svelte";

export type DispatchedEventsTypedProps = {
  children?: (this: void) => void;

  ondestroy?: (event: CustomEvent<null>) => void;

  /** Fired on mouseover. */
  onhover?: (event: CustomEvent<{ h1: boolean }>) => void;
};

export type DispatchedEventsTypedExports = Record<string, never>;

declare const DispatchedEventsTyped: Component<
  DispatchedEventsTypedProps,
  DispatchedEventsTypedExports,
  ""
>;
export default DispatchedEventsTyped;
