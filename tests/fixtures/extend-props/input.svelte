<script>
  /** @extendProps {"./Button.svelte"} ButtonProps */

  export let secondary = false;
</script>

<button {...$$restProps}>
  <slot />
</button>
