<script>
  /** @extends {"./button/button"} ButtonProps */

  export const secondary = true;

  import Button from "../button/button.svelte";
</script>

<Button {...$$restProps} on:click>
  <slot>Click me</slot>
</Button>
