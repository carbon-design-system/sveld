import type { Component } from "svelte";

export type ForwardedEventsTypedProps = {
  onblur?: (event: WindowEventMap["blur"]) => void;

  /** Fired when the button is clicked */
  onclick?: (event: WindowEventMap["click"]) => void;

  /** Fired when the button receives focus */
  onfocus?: (event: WindowEventMap["focus"]) => void;
};

export type ForwardedEventsTypedExports = Record<string, never>;

declare const ForwardedEventsTyped: Component<
  ForwardedEventsTypedProps,
  ForwardedEventsTypedExports,
  ""
>;
export default ForwardedEventsTyped;
