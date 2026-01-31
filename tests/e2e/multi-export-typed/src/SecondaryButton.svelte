<script>
  /** @extendProps {"./Button.svelte"} ButtonProps */

  export const secondary = true;

  import Button from "./Button.svelte";
</script>

<Button {...$$restProps} on:click>
  <slot>Click me</slot>
</Button>
