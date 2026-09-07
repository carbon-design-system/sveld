import type { Component } from "svelte";

export type LegacyUntypedNoDefaultProps = {
  a: any;

  b: string;

  /**
   * @default 1
   */
  c?: number;
};

export type LegacyUntypedNoDefaultExports = Record<string, never>;

declare const LegacyUntypedNoDefault: Component<
  LegacyUntypedNoDefaultProps,
  LegacyUntypedNoDefaultExports,
  ""
>;
export default LegacyUntypedNoDefault;
