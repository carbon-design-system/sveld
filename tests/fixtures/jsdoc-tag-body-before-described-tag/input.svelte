<script>
  /**
   * @restProps {div} Rest props go to the wrapper.
   * Renders the header.
   * @slot {{}} header
   */

  /**
   * @deprecated Use the body slot.
   * Renders the footer.
   * @slot {{}} footer
   */

  /**
   * @event {null} open
   * @since 1.0
   * Fired when the menu closes.
   * @event {null} close
   */

  /**
   * @slot {{}} before Renders before the list.
   * @example
   * ```svelte
   * <span slot="after">After</span>
   * ```
   * @slot {{}} after
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: dispatch("open");
  $: dispatch("close");
</script>

<div {...$$restProps}>
  <slot name="header" />
  <slot name="before" />
  <slot name="after" />
  <slot name="footer" />
</div>
