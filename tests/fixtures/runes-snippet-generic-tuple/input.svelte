<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * @generics {Row} Row
   */

  let {
    rows,
    children,
  }: {
    rows: Row[];
    children: Snippet<[row: Row, index: number]>;
  } = $props();
</script>

<ul>
  {#each rows as row, index}
    <li>{@render children(row, index)}</li>
  {/each}
</ul>
