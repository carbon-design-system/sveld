<script>
  /**
   * @typedef {{ id: string; name: string }} User
   */

  /**
   * A type guard. It accepts an `unknown` value and returns a type predicate,
   * so callers can narrow `unknown` to `User` before accessing its fields.
   *
   * @type {(value: unknown) => value is User}
   */
  export let isUser;

  /**
   * A type guard expressed as a `@callback`.
   *
   * @typedef {(value: unknown) => value is User} UserGuard
   */

  /** @type {UserGuard} */
  export let validate;
</script>

<div>{typeof isUser}{typeof validate}</div>
