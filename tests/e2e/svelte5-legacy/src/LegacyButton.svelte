<script>
  /** Label text */
  export let label;

  /** Whether the button is disabled */
  export let disabled = false;
</script>

<button {disabled}>
  {label}
  <slot />
</button>
