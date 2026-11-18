<svelte:options runes />

<script module>
  export { row };
</script>

{#snippet row(item, index = 0)}
  <li>{index}: {item}</li>
{/snippet}
