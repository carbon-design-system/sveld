<script>
  /**
   * @extends {"./Button.svelte"}
   *   ButtonProps
   * @typedef {{ id: string | number; [key: string]: any; }}
   *   DataTableRow
   * @template {DataTableRow}
   *   [Row=DataTableRow]
   */

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<button {...$$restProps}><slot {rows} /></button>
