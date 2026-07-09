import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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
  filterRows: (searchValue: string, customFilter?: (row: Row, value: string) => boolean) => ReadonlyArray<DataTableRowId>;
};

export type ContextGenericsProps<Row extends DataTableRow = DataTableRow> = {
  /**
   * Specify the rows the data table should render.
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (this: void) => void;
};

export type ContextGenericsExports = Record<string, never>;

interface ContextGenericsComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<ContextGenericsProps<Row>>
  ): SvelteComponent<ContextGenericsProps<Row>> & ContextGenericsExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: ContextGenericsProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ContextGenericsProps<Row>>): void;
  } & ContextGenericsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ContextGenerics: ContextGenericsComponent;
export default ContextGenerics;
