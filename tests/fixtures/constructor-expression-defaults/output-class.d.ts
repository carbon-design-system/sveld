import { SvelteComponentTyped } from "svelte";

export type ConstructorExpressionDefaultsProps = {
  /**
   * @default new Map()
   */
  cache?: Map<string, number>;

  /**
   * @default new Set()
   */
  selected?: Set<string>;

  /**
   * @default new Date()
   */
  createdAt?: Date;

  /**
   * @default new WeakMap()
   */
  metadata?: WeakMap<object, any>;

  /**
   * @default new Array(10)
   */
  buffer?: number[];

  /**
   * @default new Map()
   */
  items?: Map<any, any>;

  /**
   * @default new Set()
   */
  tags?: Set<any>;

  /**
   * @default new WeakMap()
   */
  weakData?: WeakMap<object, any>;

  /**
   * @default new WeakSet()
   */
  weakRefs?: WeakSet<object>;

  /**
   * @default new Array()
   */
  itemsArray?: any[];

  /**
   * @default new RegExp("test")
   */
  pattern?: RegExp;

  /**
   * @default new Error("message")
   */
  customError?: Error;
};

export default class ConstructorExpressionDefaults extends SvelteComponentTyped<
  ConstructorExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
