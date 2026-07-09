import type { Component } from "svelte";

export type ForwardedAndDispatchedEventsProps = {
  onchange?: (event: CustomEvent<any>) => void;
};

export type ForwardedAndDispatchedEventsExports = Record<string, never>;

declare const ForwardedAndDispatchedEvents: Component<
  ForwardedAndDispatchedEventsProps,
  ForwardedAndDispatchedEventsExports,
  ""
>;
export default ForwardedAndDispatchedEvents;
