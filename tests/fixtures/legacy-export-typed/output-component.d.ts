import type { Component } from "svelte";

export type LegacyExportTypedProps = {
  title: string;

  /**
   * @default 0
   */
  count?: number;
};

export type LegacyExportTypedExports = Record<string, never>;

declare const LegacyExportTyped: Component<
  LegacyExportTypedProps,
  LegacyExportTypedExports,
  ""
>;
export default LegacyExportTyped;
