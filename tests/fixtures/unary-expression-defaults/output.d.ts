import { SvelteComponentTyped } from "svelte";

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
  absolute?: undefined;
};

export default class UnaryExpressionDefaults extends SvelteComponentTyped<
  UnaryExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
