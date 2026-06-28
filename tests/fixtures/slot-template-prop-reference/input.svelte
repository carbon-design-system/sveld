<script>
  /**
   * `@template` co-located with `@slot` still sets a component generic when a prop
   * references it, so the emitted `.d.ts` doesn't name an undeclared type.
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
