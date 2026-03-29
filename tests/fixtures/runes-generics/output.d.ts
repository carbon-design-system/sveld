import { SvelteComponentTyped } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row = DataTableRow> {
  key: DataTableKey<Row>;
  value: string;
}

export type RunesGenericsProps<Row extends DataTableRow = DataTableRow> = {
  /**
   * @default []
   */
  headers?: ReadonlyArray<DataTableHeader<Row>>;

  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (
    this: void,
    ...args: [{ headers: ReadonlyArray<DataTableHeader<Row>>; rows: ReadonlyArray<Row> }]
  ) => void;
};

export default class RunesGenerics<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  RunesGenericsProps<Row>,
  Record<string, any>,
  { default: { headers: ReadonlyArray<DataTableHeader<Row>>; rows: ReadonlyArray<Row> } }
> {}
