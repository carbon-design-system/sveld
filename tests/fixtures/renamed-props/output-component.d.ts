import type { Component } from "svelte";

export type RenamedPropsProps = {
  /**
   * Just your average CSS class string.
   * @default "test"
   */
  class?: string|null;
};

export type RenamedPropsExports = Record<string, never>;

declare const RenamedProps: Component<
  RenamedPropsProps,
  RenamedPropsExports,
  ""
>;
export default RenamedProps;
