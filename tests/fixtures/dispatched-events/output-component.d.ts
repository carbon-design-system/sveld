import type { Component } from "svelte";

export type DispatchedEventsProps = {
  children?: (this: void) => void;

  ondestroy?: (event: CustomEvent<null>) => void;

  "ondestroy--component"?: (event: CustomEvent<null>) => void;

  "ondestroy:component"?: (event: CustomEvent<null>) => void;

  onhover?: (event: CustomEvent<any>) => void;
};

export type DispatchedEventsExports = Record<string, never>;

declare const DispatchedEvents: Component<
  DispatchedEventsProps,
  DispatchedEventsExports,
  ""
>;
export default DispatchedEvents;
