<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: Header; }} DataTableHeader<Row=DataTableRow,Header=DataTableRow>
   * @template {DataTableRow} [Row=DataTableRow]
   * @template {DataTableRow} [Header=DataTableRow]
   */

  /** @type {ReadonlyArray<DataTableHeader<Row, Header>>} */
  export let headers = [];

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<slot
  {headers}
  {rows}
/>
