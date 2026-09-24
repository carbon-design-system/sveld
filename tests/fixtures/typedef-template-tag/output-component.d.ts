import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type TypedefTemplateTagExports = Record<string, never>;

interface TypedefTemplateTagComponent {
  new <R extends Row = Row>(
    options: ComponentConstructorOptions<TypedefTemplateTagProps<R>>
  ): SvelteComponent<TypedefTemplateTagProps<R>> & TypedefTemplateTagExports;
  <R extends Row = Row>(
    this: void,
    internals: ComponentInternals,
    props: TypedefTemplateTagProps<R>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TypedefTemplateTagProps<R>>): void;
  } & TypedefTemplateTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TypedefTemplateTag: TypedefTemplateTagComponent;
export default TypedefTemplateTag;
