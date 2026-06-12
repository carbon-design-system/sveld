<script>
  /**
   * `@template` co-located with `@slot` still sets component generics when the block
   * also declares `@extends` (the generic parameterizes the inherited props).
   * @template [Icon=any]
   * @extends {"./Button.svelte"} ButtonProps
   * @slot {{}} badge - Optional badge overlay.
   */

  /** @type {Icon} */
  export let icon = /** @type {Icon} */ (undefined);
</script>

<slot name="badge" />
