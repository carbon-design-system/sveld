<script>
  /**
   * Bind to the current value emitted by the component.
   * @bindable readonly
   */
  export let size = undefined;

  /**
   * Bind to state controlled by either the consumer or component.
   * @bindable writable
   */
  export let open = false;

  /** Regular unannotated prop. */
  export let label = "Toggle";

  function toggle() {
    open = !open;
  }
</script>

<button on:click={toggle}>{label}</button>
<span>{size}</span>
