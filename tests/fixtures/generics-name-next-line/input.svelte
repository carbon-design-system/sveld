<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @generics {Row extends DataTableRow = DataTableRow,
   *   Key extends keyof Row = keyof Row}
   *   Row,Key
   */

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];

  /** @type {Key | undefined} */
  export let sortKey = undefined;
</script>

<slot
  {rows}
  {sortKey}
/>
