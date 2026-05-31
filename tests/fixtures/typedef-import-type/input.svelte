<script>
  /**
   * A store imported from `svelte/store`. The `import(...)` type is resolved at
   * type level and emitted verbatim — no top-level `import` statement required.
   *
   * @type {import("svelte/store").Writable<string>}
   */
  export let value;

  /**
   * A read-only store.
   * @type {import("svelte/store").Readable<number>}
   */
  export let count;

  /**
   * `typeof import(...)` references the type of a value export — here the
   * `writable` factory itself, rather than a type it exports.
   *
   * @type {typeof import("svelte/store").writable}
   */
  export let createStore;

  /**
   * Reuse another component's props with Svelte's `ComponentProps` utility.
   * @type {import("svelte").ComponentProps<import("svelte").SvelteComponent>}
   */
  export let buttonProps;

  /**
   * The value stored under a Svelte context key, typed with imported store
   * types. `import(...)` works inside a `@typedef` too.
   *
   * @typedef {{ rows: import("svelte/store").Writable<string[]>; selected: import("svelte/store").Readable<number> }} TableContext
   */

  /** @type {TableContext} */
  export let context;
</script>
