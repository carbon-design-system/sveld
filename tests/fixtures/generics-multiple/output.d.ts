import { SvelteComponentTyped } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row = DataTableRow, Header = DataTableRow> {
  key: DataTableKey<Row>;
  value: Header;
}

export type GenericsMultipleProps<Row, Header> = {
  /**
   * @default []
   */
  headers?: ReadonlyArray<DataTableHeader<Row, Header>>;

  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (
    this: void,
    ...args: [{ headers: ReadonlyArray<DataTableHeader<Row, Header>>; rows: ReadonlyArray<Row> }]
  ) => void;
};

export default class GenericsMultiple<
  Row extends DataTableRow = DataTableRow,
  Header extends DataTableRow = DataTableRow,
> extends SvelteComponentTyped<
  GenericsMultipleProps<Row, Header>,
  Record<string, any>,
  { default: { headers: ReadonlyArray<DataTableHeader<Row, Header>>; rows: ReadonlyArray<Row> } }
> {}
