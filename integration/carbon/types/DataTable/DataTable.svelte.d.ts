/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export type DataTableKey = string;

export type DataTableValue = any;

export interface DataTableEmptyHeader {
  key: DataTableKey;
  empty: boolean;
  display?: (item: Value) => DataTableValue;
  sort?: (a: DataTableValue, b: DataTableValue) => 0 | -1 | 1;
  columnMenu?: boolean;
}

export interface DataTableNonEmptyHeader {
  key: DataTableKey;
  value: DataTableValue;
  display?: (item: Value) => DataTableValue;
  sort?: (a: DataTableValue, b: DataTableValue) => 0 | -1 | 1;
  columnMenu?: boolean;
}

export type DataTableHeader = DataTableNonEmptyHeader | DataTableEmptyHeader;

export interface DataTableRow {
  id: any;
  [key: string]: DataTableValue;
}

export type DataTableRowId = string;

export interface DataTableCell {
  key: DataTableKey;
  value: DataTableValue;
}

export interface DataTableProps {
  /**
   * Specify the data table headers
   * @default []
   */
  headers?: DataTableHeader[];

  /**
   * Specify the rows the data table should render
   * keys defined in `headers` are used for the row ids
   * @default []
   */
  rows?: DataTableRow[];

  /**
   * Set the size of the data table
   */
  size?: "compact" | "short" | "tall";

  /**
   * Specify the title of the data table
   * @default ""
   */
  title?: string;

  /**
   * Specify the description of the data table
   * @default ""
   */
  description?: string;

  /**
   * Set to `true` to use zebra styles
   * @default false
   */
  zebra?: boolean;

  /**
   * Set to `true` for the sortable variant
   * @default false
   */
  sortable?: boolean;

  /**
   * Set to `true` for the expandable variant
   * Automatically set to `true` if `batchExpansion` is `true`
   * @default false
   */
  expandable?: boolean;

  /**
   * Set to `true` to enable batch expansion
   * @default false
   */
  batchExpansion?: boolean;

  /**
   * Specify the row ids to be expanded
   * @default []
   */
  expandedRowIds?: DataTableRowId[];

  /**
   * Set to `true` for the radio selection variant
   * @default false
   */
  radio?: boolean;

  /**
   * Set to `true` for the selectable variant
   * Automatically set to `true` if `radio` or `batchSelection` are `true`
   * @default false
   */
  selectable?: boolean;

  /**
   * Set to `true` to enable batch selection
   * @default false
   */
  batchSelection?: boolean;

  /**
   * Specify the row ids to be selected
   * @default []
   */
  selectedRowIds?: DataTableRowId[];

  /**
   * Set to `true` to enable a sticky header
   * @default false
   */
  stickyHeader?: boolean;
}

export default class DataTable extends SvelteComponentTyped<
  DataTableProps,
  {
    click: CustomEvent<{
      header?: DataTableHeader;
      row?: DataTableRow;
      cell?: DataTableCell;
    }>;
    ["click:header--expand"]: CustomEvent<{ expanded: boolean }>;
    ["click:header"]: CustomEvent<{
      header: DataTableHeader;
      sortDirection: "ascending" | "descending" | "none";
    }>;
    ["click:row"]: CustomEvent<DataTableRow>;
    ["mouseenter:row"]: CustomEvent<DataTableRow>;
    ["mouseleave:row"]: CustomEvent<DataTableRow>;
    ["click:row--expand"]: CustomEvent<{
      expanded: boolean;
      row: DataTableRow;
    }>;
    ["click:cell"]: CustomEvent<DataTableCell>;
  },
  {
    default: {};
    cell: { row: DataTableRow; cell: DataTableCell };
    ["cell-header"]: { header: DataTableNonEmptyHeader };
    ["expanded-row"]: { row: DataTableRow };
  }
> {}
