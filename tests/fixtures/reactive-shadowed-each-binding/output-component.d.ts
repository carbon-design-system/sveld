import type { Component } from "svelte";

export type ReactiveShadowedEachBindingProps = {
  /**
   * @default ""
   */
  value?: string;
};

export type ReactiveShadowedEachBindingExports = Record<string, never>;

declare const ReactiveShadowedEachBinding: Component<
  ReactiveShadowedEachBindingProps,
  ReactiveShadowedEachBindingExports,
  ""
>;
export default ReactiveShadowedEachBinding;
