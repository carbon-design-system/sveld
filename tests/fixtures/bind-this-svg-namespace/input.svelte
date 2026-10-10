<svelte:options namespace="svg" />

<script>
  export let linkRef = null;
  export let groupRef = null;
</script>

<g bind:this={groupRef}>
  <a
    bind:this={linkRef}
    href="/"
  >
    <circle />
  </a>
</g>
