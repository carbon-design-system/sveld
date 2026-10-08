<script>
  /**
   * @snippet {[item: string, index: number]} row - One row per item.
   * @snippet {{ count: number }} footer - Below the list.
   */
  let { row, footer } = $props();

  const items = ["a", "b"];
</script>

{#each items as item, index}
  {@render row?.(item, index)}
{/each}
{@render footer?.({ count: items.length })}
