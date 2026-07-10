<script lang="ts" generics="Item extends { id: string | number } = { id: string }">
  import type { Snippet } from "svelte";

  let {
    items,
    row,
  }: {
    items: Item[];
    row: Snippet<[item: Item]>;
  } = $props();
</script>

<ul>
  {#each items as item (item.id)}
    <li>{@render row(item)}</li>
  {/each}
</ul>
