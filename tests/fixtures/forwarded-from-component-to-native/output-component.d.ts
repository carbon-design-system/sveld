import type { Component } from "svelte";

export type ForwardedFromComponentToNativeProps = {
  onclick?: (event: WindowEventMap["click"]) => void;

  oncollapse?: (event: CustomEvent<null>) => void;

  onexpand?: (event: CustomEvent<null>) => void;

  onmouseenter?: (event: WindowEventMap["mouseenter"]) => void;

  onmouseleave?: (event: WindowEventMap["mouseleave"]) => void;

  onmouseover?: (event: WindowEventMap["mouseover"]) => void;
};

export type ForwardedFromComponentToNativeExports = Record<string, never>;

declare const ForwardedFromComponentToNative: Component<
  ForwardedFromComponentToNativeProps,
  ForwardedFromComponentToNativeExports,
  ""
>;
export default ForwardedFromComponentToNative;
