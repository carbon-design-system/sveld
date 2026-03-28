<script>
  export let value = "";
  const items = ["a", "b"];
</script>

{#each items as value}
  <Child bind:value />
{/each}
