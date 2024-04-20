<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row>
   * @template {DataTableRow} Row
   * @generics {Row extends DataTableRow = DataTableRow} Row
   */

  /** @type {ReadonlyArray<DataTableHeader<Row>>} */
   export let headers = [];

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<slot {rows} />
