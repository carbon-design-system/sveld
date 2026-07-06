<svelte:options customElement="x-badge" />

<script>
  /** The badge label. */
  export let label = "";
</script>

<span>{label}</span>

<slot />
