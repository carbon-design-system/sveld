import type { Component } from "svelte";

export type DispatchedEventsDynamicProps = {
  onKEY?: (event: CustomEvent<{ key: string }>) => void;
};

export type DispatchedEventsDynamicExports = Record<string, never>;

declare const DispatchedEventsDynamic: Component<
  DispatchedEventsDynamicProps,
  DispatchedEventsDynamicExports,
  ""
>;
export default DispatchedEventsDynamic;
