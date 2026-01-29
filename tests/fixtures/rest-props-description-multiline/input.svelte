<script>
  /**
   * Rest props are spread to the span (inline variant)
   * or the copy button (single/multi).
   *
   * @restProps {button | span}
   */
  /** @type {"inline" | "single" | "multi"} */
  export let variant = "single";
</script>

{#if variant === "inline"}
  <span {...$$restProps}>inline</span>
{:else}
  <button {...$$restProps}>copy</button>
{/if}
