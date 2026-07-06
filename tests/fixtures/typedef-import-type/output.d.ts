import { SvelteComponentTyped } from "svelte";

/**
 * The value stored under a Svelte context key, typed with imported store
 * types. `import(...)` works inside a `@typedef` too.
 */
export interface TableContext {
  rows: import("svelte/store").Writable<string[]>;
  selected: import("svelte/store").Readable<number>
}

export type TypedefImportTypeProps = {
  /**
   * A store imported from `svelte/store`. The `import(...)` type is resolved at
   * type level and emitted verbatim — no top-level `import` statement required.
   * @default undefined
   */
  value: import("svelte/store").Writable<string>;

  /**
   * A read-only store.
   * @default undefined
   */
  count: import("svelte/store").Readable<number>;

  /**
   * `typeof import(...)` references the type of a value export — here the
   * `writable` factory itself, rather than a type it exports.
   * @default undefined
   */
  createStore: typeof import("svelte/store").writable;

  /**
   * Reuse another component's props with Svelte's `ComponentProps` utility.
   * @default undefined
   */
  buttonProps: import("svelte").ComponentProps<import("svelte").SvelteComponent>;

  /**
   * The value stored under a Svelte context key, typed with imported store
   * types. `import(...)` works inside a `@typedef` too.
   * @default undefined
   */
  context: TableContext;
};

export default class TypedefImportType extends SvelteComponentTyped<
  TypedefImportTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
