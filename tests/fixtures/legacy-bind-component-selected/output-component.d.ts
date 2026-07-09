import type { Component } from "svelte";

export type LegacyBindComponentSelectedProps = {
  /**
   * @default 10
   */
  pageSize?: number;
};

export type LegacyBindComponentSelectedExports = Record<string, never>;

declare const LegacyBindComponentSelected: Component<
  LegacyBindComponentSelectedProps,
  LegacyBindComponentSelectedExports,
  ""
>;
export default LegacyBindComponentSelected;
