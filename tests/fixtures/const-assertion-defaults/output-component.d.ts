import type { Component } from "svelte";

export type ConstAssertionDefaultsProps = {
  /**
   * @default { sm: false, md: true }
   */
  sizes?: {
    readonly sm: false;
    readonly md: true
  };

  /**
   * @default ["a", "b"]
   */
  items?: readonly ["a", "b"];

  /**
   * @default { steps: [1, 2] }
   */
  nested?: { readonly steps: readonly [1, 2] };

  /**
   * @default "sm"
   */
  size?: "sm";

  /**
   * @default { sm: false }
   */
  widened?: { sm: boolean };
};

export type ConstAssertionDefaultsExports = {
  ids: { readonly close: "close" };
};

declare const ConstAssertionDefaults: Component<
  ConstAssertionDefaultsProps,
  ConstAssertionDefaultsExports,
  ""
>;
export default ConstAssertionDefaults;
