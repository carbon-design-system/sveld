import type { Component } from "svelte";

export type UnaryExpressionDefaultsProps = {
  /**
   * Negative number constant
   * @default -1
   */
  offset?: number;

  /**
   * Negative decimal
   * @default -0.5
   */
  threshold?: number;

  /**
   * @default !false
   */
  inverted?: boolean;

  /**
   * Bitwise NOT
   * @default ~0
   */
  bitmask?: number;

  /**
   * Double negation
   * @default -(-5)
   */
  absolute?: number;
};

export type UnaryExpressionDefaultsExports = Record<string, never>;

declare const UnaryExpressionDefaults: Component<
  UnaryExpressionDefaultsProps,
  UnaryExpressionDefaultsExports,
  ""
>;
export default UnaryExpressionDefaults;
