import type { Component } from "svelte";

export type ReactiveShadowedCallbackParamProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export type ReactiveShadowedCallbackParamExports = Record<string, never>;

declare const ReactiveShadowedCallbackParam: Component<
  ReactiveShadowedCallbackParamProps,
  ReactiveShadowedCallbackParamExports,
  ""
>;
export default ReactiveShadowedCallbackParam;
