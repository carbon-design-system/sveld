import type { Component } from "svelte";

export type ForwardedCustomEventNullProps = {
  /** Clear button clicked with no data */
  onclear?: (event: CustomEvent<null>) => void;

  /** Search query changed */
  onsearch?: (event: CustomEvent<string>) => void;
};

export type ForwardedCustomEventNullExports = Record<string, never>;

declare const ForwardedCustomEventNull: Component<
  ForwardedCustomEventNullProps,
  ForwardedCustomEventNullExports,
  ""
>;
export default ForwardedCustomEventNull;
