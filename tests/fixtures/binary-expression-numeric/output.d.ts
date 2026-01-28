import { SvelteComponentTyped } from "svelte";

export type BinaryExpressionNumericProps = {
  /**
   * @default 1 + 2
   */
  sum?: number;

  /**
   * @default 3 * 4
   */
  product?: number;

  /**
   * @default 10 / 2
   */
  ratio?: number;

  /**
   * @default 17 % 5
   */
  remainder?: number;

  /**
   * @default (2 + 3) * 4
   */
  computed?: number;

  /**
   * @default 2 * Math.PI * 10
   */
  circumference?: number;

  /**
   * @default 1 | 2 | 4
   */
  flags?: number;
};

export default class BinaryExpressionNumeric extends SvelteComponentTyped<
  BinaryExpressionNumericProps,
  Record<string, any>,
  Record<string, never>
> {}
