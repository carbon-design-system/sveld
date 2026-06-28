<script>
  /**
   * `@template` in a `@slot` block becomes a component generic when a prop uses the name.
   * Without that, `.d.ts` references an undeclared type (TS2304).
   * @template [Icon=any]
   * @slot {{}} icon
   */

  /**
   * Specify the icon to render.
   * @type {Icon}
   */
  export let icon = undefined;
</script>

<slot name="icon" />
