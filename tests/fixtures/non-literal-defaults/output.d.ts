import type { SvelteComponentTyped } from "svelte";

export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type NonLiteralDefaultsProps = {
  /**
   * Position of the element
   * @default TOP_LEFT
   */
  position?: Position;

  /**
   * Theme mode
   * @default POSITION_DEFAULT
   */
  theme?: undefined;

  /**
   * Numeric constant with Infinity
   * @default undefined
   */
  maxValue?: undefined;

  /**
   * Optional handler with undefined
   * @default undefined
   */
  handler?: undefined;
};

export default class NonLiteralDefaults extends SvelteComponentTyped<
  NonLiteralDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
