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

export type ContextTemplateTagProps<Row extends DataTableRow = DataTableRow> = {
  /**
   * Specify the rows the data table should render.
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (this: void) => void;
};

export type ContextTemplateTagExports = Record<string, never>;

interface ContextTemplateTagComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<ContextTemplateTagProps<Row>>
  ): SvelteComponent<ContextTemplateTagProps<Row>> & ContextTemplateTagExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: ContextTemplateTagProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ContextTemplateTagProps<Row>>): void;
  } & ContextTemplateTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ContextTemplateTag: ContextTemplateTagComponent;
export default ContextTemplateTag;
