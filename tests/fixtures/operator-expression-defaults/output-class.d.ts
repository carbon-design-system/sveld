import { SvelteComponentTyped } from "svelte";

export type OperatorExpressionDefaultsProps = {
  /**
   * @default 1
   */
  size?: number;

  /**
   * @default "x"
   */
  label?: string;

  /**
   * @default undefined
   */
  prefix?: string | undefined;

  /**
   * Arithmetic
   * @default size * 2
   */
  doubled?: number;

  /**
   * Numeric addition
   * @default size + 1
   */
  next?: number;

  /**
   * String concatenation with a string-typed prop
   * @default label + "-end"
   */
  suffixed?: string;

  /**
   * String concatenation with a number
   * @default size + "px"
   */
  withUnit?: string;

  /**
   * `+` of two untyped values can't be told apart
   * @default prefix + factor
   */
  unknownSum?: any;

  /**
   * Bitwise
   * @default size | 0
   */
  truncated?: number;

  /**
   * Comparison
   * @default size > factor
   */
  isLarge?: boolean;

  /**
   * `in`
   * @default "key" in {}
   */
  hasKey?: boolean;

  /**
   * Logical not
   * @default !size
   */
  hidden?: boolean;

  /**
   * typeof
   * @default typeof size
   */
  kind?: string;

  /**
   * Nullish fallback of the same type
   */
  count?: number;

  /**
   * Mixed fallback
   */
  either?: number | string;

  /**
   * Conditional
   */
  variant?: string;

  /**
   * Object literal whose member isn't a literal
   * @default { x: size, y: 0 }
   */
  point?: any;

  /**
   * Array literal whose element isn't a literal
   * @default [size, 1]
   */
  pair?: any;

  /**
   * @default size * factor
   */
  area?: number;
};

export default class OperatorExpressionDefaults extends SvelteComponentTyped<
  OperatorExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
