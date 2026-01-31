<script>
  /** @type {string} */
  export let type = "button";
</script>

<button {type} {...$$restProps}>
  <slot />
</button>
