import type { Component } from "svelte";

export type ForwardedNativeWithDetailProps = {
  /** The input value when changed */
  onchange?: (event: CustomEvent<string>) => void;
};

export type ForwardedNativeWithDetailExports = Record<string, never>;

declare const ForwardedNativeWithDetail: Component<
  ForwardedNativeWithDetailProps,
  ForwardedNativeWithDetailExports,
  ""
>;
export default ForwardedNativeWithDetail;
