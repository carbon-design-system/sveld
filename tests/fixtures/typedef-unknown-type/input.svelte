<script>
  /**
   * A value of unknown shape. Prefer `unknown` over `any`: consumers must
   * narrow it before use instead of silently opting out of type checking.
   *
   * @type {unknown}
   */
  export let payload;

  /**
   * An escape hatch typed as `any`, shown for contrast. `any` disables type
   * checking everywhere it flows, so reach for `unknown` at boundaries instead.
   *
   * @type {any}
   */
  export let raw;
</script>

<div>{JSON.stringify(payload)}{raw}</div>
