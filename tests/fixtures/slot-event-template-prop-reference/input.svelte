<script>
  /**
   * `@template` shared with both `@event` and `@slot` still sets a component generic
   * when a prop references it.
   * @template [Icon=any]
   * @event {Icon} select
   * @slot {{}} icon
   */

  /** @type {Icon} */
  export let icon = undefined;
</script>

<slot name="icon" />
