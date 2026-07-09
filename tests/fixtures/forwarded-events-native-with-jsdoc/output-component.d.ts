import type { Component } from "svelte";

export type ForwardedEventsNativeWithJsdocProps = {
  children?: (this: void) => void;

  /** Fired when the button loses focus */
  onblur?: (event: WindowEventMap["blur"]) => void;

  /** Fired when the button is clicked */
  onclick?: (event: WindowEventMap["click"]) => void;

  /** Fired when the button receives focus */
  onfocus?: (event: WindowEventMap["focus"]) => void;
};

export type ForwardedEventsNativeWithJsdocExports = Record<string, never>;

declare const ForwardedEventsNativeWithJsdoc: Component<
  ForwardedEventsNativeWithJsdocProps,
  ForwardedEventsNativeWithJsdocExports,
  ""
>;
export default ForwardedEventsNativeWithJsdoc;
