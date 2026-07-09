import type { Component } from "svelte";

export type LegacyBindComponentRefProps = {
  /**
   * @default null
   */
  ref?: undefined;
};

export type LegacyBindComponentRefExports = Record<string, never>;

declare const LegacyBindComponentRef: Component<
  LegacyBindComponentRefProps,
  LegacyBindComponentRefExports,
  ""
>;
export default LegacyBindComponentRef;
