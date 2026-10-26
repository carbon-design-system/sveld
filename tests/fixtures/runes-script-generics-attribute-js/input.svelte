<script module>
  /** @typedef {{ id: string }} Entry */
</script>

<script generics="Item extends Entry = Entry">
  /** @type {{ items?: ReadonlyArray<Item>; selected?: Item }} */
  let { items = [], selected = undefined } = $props();
</script>

{#each items as item (item.id)}
  <span class:selected={item === selected}>{item.id}</span>
{/each}
