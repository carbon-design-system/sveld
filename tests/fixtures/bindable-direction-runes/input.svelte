<script>
  let {
    /**
     * Bind to the current value emitted by the component.
     * @bindable readonly
     */
    size = undefined,

    /**
     * Bind to state controlled by either the consumer or component.
     * @bindable writable
     */
    open = $bindable(false),

    /** Regular unannotated prop. */
    label = "Toggle",
  } = $props();
</script>

<button>{label}</button>
<span>{size}</span>
{#if open}
  <span>Open</span>
{/if}
