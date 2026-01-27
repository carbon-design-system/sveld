<script>
  /** @restProps {td | th} */
  /** @type { "td" | "th" } */
  export let cellType = "td";
</script>

{#if cellType === "td"}
  <td {...$$restProps} />
{:else}
  <th {...$$restProps} />
{/if}
