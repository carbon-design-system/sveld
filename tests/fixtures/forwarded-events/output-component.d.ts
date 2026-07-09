import type { Component } from "svelte";

export type ForwardedEventsProps = {
  children?: (this: void) => void;

  onblur?: (event: WindowEventMap["blur"]) => void;

  onclick?: (event: WindowEventMap["click"]) => void;

  onfocus?: (event: WindowEventMap["focus"]) => void;

  onmouseover?: (event: WindowEventMap["mouseover"]) => void;
};

export type ForwardedEventsExports = Record<string, never>;

declare const ForwardedEvents: Component<
  ForwardedEventsProps,
  ForwardedEventsExports,
  ""
>;
export default ForwardedEvents;
