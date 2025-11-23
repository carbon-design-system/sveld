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
   * @default Number.POSITIVE_INFINITY
   */
  maxValue?: number;

  /**
   * Negative infinity constant
   * @default Number.NEGATIVE_INFINITY
   */
  minValue?: number;

  /**
   * Maximum safe integer
   * @default Number.MAX_SAFE_INTEGER
   */
  maxSafeInt?: number;

  /**
   * Minimum safe integer
   * @default Number.MIN_SAFE_INTEGER
   */
  minSafeInt?: number;

  /**
   * Maximum numeric value
   * @default Number.MAX_VALUE
   */
  maxNumber?: number;

  /**
   * Minimum numeric value
   * @default Number.MIN_VALUE
   */
  minNumber?: number;

  /**
   * Math constant PI
   * @default Math.PI
   */
  pi?: number;

  /**
   * Math constant E
   * @default Math.E
   */
  e?: number;

  /**
   * Optional handler with undefined
   * @default undefined
   */
  handler?: undefined;

  /**
   * Append to element
   * @default document.body
   */
  appendTo?: HTMLElement;
};

export default class NonLiteralDefaults extends SvelteComponentTyped<
  NonLiteralDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
