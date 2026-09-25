import { SvelteComponentTyped } from "svelte";

/**
 * An observable list.
 */
export declare class List<T> {
  items: T[];

  /**
   * Max length; untyped.
   */
  static limit: any;

  untyped: any;

  constructor(initial: T[], label?: string);

  /**
   * The list's label.
   */
  label: any;

  /**
   * Adds an item.
   */
  push(item: T): number;

  map<U>(fn: (item: T) => U): List<U>;

  clear(): any;
}

export type ModuleClassJsdocProps = Record<string, never>;

export default class ModuleClassJsdoc extends SvelteComponentTyped<
  ModuleClassJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
