import { SvelteComponentTyped } from "svelte";

type $Props<T = any> = {
  /**
   * Specify the rows.
   * @default []
   */
  data?: ReadonlyArray<T>;

  /**
   * Specify the x accessor: a property name or a function.
   */
  x: (keyof T & string) | ((row: T, index: number) => number | string);
};

export type BaseProps<T = any> = $Props<T>;

export default class Base<T = any> extends SvelteComponentTyped<
  BaseProps<T>,
  Record<string, any>,
  Record<string, never>
> {}
