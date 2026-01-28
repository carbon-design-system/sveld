import { SvelteComponentTyped } from "svelte";

export type ConstructorExpressionDefaultsProps = {
  /**
   * @default undefined
   */
  cache?: Map<string, number>;

  /**
   * @default undefined
   */
  selected?: Set<string>;

  /**
   * @default undefined
   */
  createdAt?: undefined;

  /**
   * @default undefined
   */
  metadata?: WeakMap<object, any>;

  /**
   * @default undefined
   */
  buffer?: number[];
};

export default class ConstructorExpressionDefaults extends SvelteComponentTyped<
  ConstructorExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
