import type { Component } from "svelte";

export type LegacyPassThroughNonreactiveProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export type LegacyPassThroughNonreactiveExports = Record<string, never>;

declare const LegacyPassThroughNonreactive: Component<
  LegacyPassThroughNonreactiveProps,
  LegacyPassThroughNonreactiveExports,
  ""
>;
export default LegacyPassThroughNonreactive;
