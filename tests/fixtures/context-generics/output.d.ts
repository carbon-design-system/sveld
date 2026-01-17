import { SvelteComponentTyped } from "svelte";

export interface DataTableRow {
  id: any;
  [key: string]: any;
}

export type DataTableRowId = any;

export type DataTableContext<Row extends DataTableRow = DataTableRow> = {
  batchSelectedIds: import("svelte/store").Writable<ReadonlyArray<DataTableRowId>>;
  tableRows: import("svelte/store").Writable<ReadonlyArray<Row>>;
  /** Reset selected row ids */
  resetSelectedRowIds: () => void;
  /** Filter rows by search value */
  filterRows: (
    searchValue: string,
    customFilter?: (row: Row, value: string) => boolean,
  ) => ReadonlyArray<DataTableRowId>;
};

export type ContextGenericsProps<Row> = {
  /**
   * Specify the rows the data table should render.
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (this: void) => void;
};

export default class ContextGenerics<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  ContextGenericsProps<Row>,
  Record<string, any>,
  { default: Record<string, never> }
> {}
