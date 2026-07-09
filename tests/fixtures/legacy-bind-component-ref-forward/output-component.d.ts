import type { Component } from "svelte";

export type LegacyBindComponentRefForwardProps = {
  /**
   * @default null
   */
  listRef?: undefined;
};

export type LegacyBindComponentRefForwardExports = Record<string, never>;

declare const LegacyBindComponentRefForward: Component<
  LegacyBindComponentRefForwardProps,
  LegacyBindComponentRefForwardExports,
  ""
>;
export default LegacyBindComponentRefForward;
