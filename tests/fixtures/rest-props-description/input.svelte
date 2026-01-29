<script>
  /**
   * @restProps {button | span} Spread to the span (inline variant) or the copy button (single/multi).
   */
  /** @type {"inline" | "single" | "multi"} */
  export let variant = "single";
</script>

{#if variant === "inline"}
  <span {...$$restProps}>inline</span>
{:else}
  <button {...$$restProps}>copy</button>
{/if}
