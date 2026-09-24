import { SvelteComponentTyped } from "svelte";

/**
 * A boxed value.
 */
export interface Box<T> {
  value: T
}

export type Entry<K extends string, V = unknown> = {
  /** The key. */
  key: K;
  /** The value. */
  value: V;
};

export type Mapper<T> = (item: T) => string;

export interface Row {
  id: string
}

export type TypedefTemplateTagProps<R extends Row = Row> = {
  /**
   * @default { value: 1 }
   */
  box?: Box<number>;

  /**
   * @default { key: "a", value: 1 }
   */
  entry?: Entry<"a", number>;

  /**
   * @default (item) => item.id
   */
  mapper?: Mapper<R>;
};

export default class TypedefTemplateTag<R extends Row = Row> extends SvelteComponentTyped<
  TypedefTemplateTagProps<R>,
  Record<string, any>,
  Record<string, never>
> {}
