<script>
  /**
   * @typedef {{ id: string; size: "sm" | "md" | "lg"; disabled: boolean }} Options
   * @typedef {() => Options} Factory
   * @typedef {string & { readonly __brand: "UserId" }} UserId
   * @typedef {{ id: string; name: string }} User
   * @typedef {(value: unknown) => value is User} UserGuard
   */

  /** @type {Pick<Options, "id" | "size">} */
  export let summary;

  /** @type {Omit<Options, "disabled">} */
  export let editable;

  /** @type {ReturnType<Factory>} */
  export let defaults;

  /** @type {Awaited<Promise<Options>>} */
  export let resolved;

  /** @type {UserId} */
  export let userId;

  /** @type {(value: unknown) => value is User} */
  export let isUser;

  /** @type {UserGuard} */
  export let validate;

  /** @type {unknown} */
  export let payload;

  /** @type {any} */
  export let raw;
</script>
