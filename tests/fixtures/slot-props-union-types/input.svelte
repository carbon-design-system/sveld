<script>
  /**
   * @slot {{ item: string | number; status: "pending" | "complete" | "error"; error: Error | null; }}
   * @slot {{ active: boolean }} header - Header slot
   */
  /** @type {Array<{ value: string | number; status: "pending" | "complete" | "error" }>} */
  export let items = [];
</script>

<header>
  <slot name="header" active={items.length > 0} />
</header>

{#each items as item}
  <slot item={item.value} status={item.status} error={null} />
{/each}
