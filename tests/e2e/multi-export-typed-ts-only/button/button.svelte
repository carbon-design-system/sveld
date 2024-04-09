<script>
  /** @type {"button" | "submit" | "reset"} */
  export let type = "button";

  /**
   * Set to `true` to use the primary variant
   */
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
