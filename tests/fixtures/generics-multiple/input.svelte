<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: Header; }} DataTableHeader<Row=DataTableRow,Header=DataTableRow>
   * @template {DataTableRow} <Row extends DataTableRow = DataTableRow>
   * @generics {Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow} Row,Header
   */

  /** @type {ReadonlyArray<DataTableHeader<Row, Header>>} */
  export let headers = [];

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<slot {headers} {rows} />
