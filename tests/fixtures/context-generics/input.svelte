<script>
  import { setContext } from "svelte";
  import { writable } from "svelte/store";

  /**
   * @typedef {{ id: any; [key: string]: any; }} DataTableRow
   * @typedef {any} DataTableRowId
   * @generics {Row extends DataTableRow = DataTableRow} Row
   */

  /**
   * Specify the rows the data table should render.
   * @type {ReadonlyArray<Row>}
   */
  export let rows = [];

  /**
   * @type {import("svelte/store").Writable<ReadonlyArray<DataTableRowId>>}
   */
  const batchSelectedIds = writable([]);

  /**
   * @type {import("svelte/store").Writable<ReadonlyArray<Row>>}
   */
  const tableRows = writable(rows);

  /**
   * Reset selected row ids
   * @type {() => void}
   */
  const resetSelectedRowIds = () => {};

  /**
   * Filter rows by search value
   * @type {(searchValue: string, customFilter?: (row: Row, value: string) => boolean) => ReadonlyArray<DataTableRowId>}
   */
  const filterRows = (searchValue, customFilter) => [];

  setContext("DataTable", {
    batchSelectedIds,
    tableRows,
    resetSelectedRowIds,
    filterRows,
  });
</script>

<div>
  <slot />
</div>
