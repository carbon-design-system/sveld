import type { Component } from "svelte";

export type ForwardedCustomEventsProps = {
  /** Fired when clear button is clicked */
  onclear?: (event: CustomEvent<KeyboardEvent | MouseEvent>) => void;

  onclick?: (event: WindowEventMap["click"]) => void;
};

export type ForwardedCustomEventsExports = Record<string, never>;

declare const ForwardedCustomEvents: Component<
  ForwardedCustomEventsProps,
  ForwardedCustomEventsExports,
  ""
>;
export default ForwardedCustomEvents;
