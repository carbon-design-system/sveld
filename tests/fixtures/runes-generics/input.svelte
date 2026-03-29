<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row=DataTableRow>
   * @template {DataTableRow} <Row extends DataTableRow = DataTableRow>
   * @generics {Row extends DataTableRow = DataTableRow} Row
   */

  let {
    /** @type {ReadonlyArray<DataTableHeader<Row>>} */
    headers = [],
    /** @type {ReadonlyArray<Row>} */
    rows = [],
    children,
  } = $props();
</script>

{@render children?.({ headers, rows })}
