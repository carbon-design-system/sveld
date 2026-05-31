<script>
  /**
   * The full set of options. Other prop types are derived from this one
   * instead of redeclaring its fields.
   *
   * @typedef {{ id: string; size: "sm" | "md" | "lg"; disabled: boolean }} Options
   */

  /**
   * A factory that produces an `Options` value.
   *
   * @typedef {() => Options} Factory
   */

  /**
   * A read-only subset of `Options`.
   * @type {Pick<Options, "id" | "size">}
   */
  export let summary;

  /**
   * Everything in `Options` except `disabled`.
   * @type {Omit<Options, "disabled">}
   */
  export let editable;

  /**
   * Derived from the factory's return type rather than restated.
   * @type {ReturnType<Factory>}
   */
  export let defaults;

  /**
   * The resolved value of an async source.
   * @type {Awaited<Promise<Options>>}
   */
  export let resolved;
</script>

<div
  data-id={summary.id}
  data-editable={editable.id}
>
  {defaults.id}{resolved.id}
</div>
