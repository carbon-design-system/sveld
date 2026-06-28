<script>
  /**
   * `@template` shared by `@event` and `@slot` still becomes a component generic when a prop uses it.
   * @template [Icon=any]
   * @event {Icon} select
   * @slot {{}} icon
   */

  /** @type {Icon} */
  export let icon = undefined;
</script>

<slot name="icon" />
