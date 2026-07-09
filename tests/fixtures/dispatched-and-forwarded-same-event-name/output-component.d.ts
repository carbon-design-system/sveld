import type { Component } from "svelte";

export type DispatchedAndForwardedSameEventNameProps = {
  onclick?: (event: CustomEvent<any>) => void;
};

export type DispatchedAndForwardedSameEventNameExports = Record<string, never>;

declare const DispatchedAndForwardedSameEventName: Component<
  DispatchedAndForwardedSameEventNameProps,
  DispatchedAndForwardedSameEventNameExports,
  ""
>;
export default DispatchedAndForwardedSameEventName;
