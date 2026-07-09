import type { Component } from "svelte";

export type LegacyBindComponentValueProps = {
  /**
   * @default ""
   */
  value?: string;
};

export type LegacyBindComponentValueExports = Record<string, never>;

declare const LegacyBindComponentValue: Component<
  LegacyBindComponentValueProps,
  LegacyBindComponentValueExports,
  ""
>;
export default LegacyBindComponentValue;
