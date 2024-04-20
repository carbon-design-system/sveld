import type { SvelteComponentTyped } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row> {
  key: DataTableKey<Row>;
  value: string;
}

export interface GenericsProps<Row> {
  /**
   * @default []
   */
  headers?: ReadonlyArray<DataTableHeader<Row>>;

  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;
}

export default class Generics<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  GenericsProps<Row>,
  Record<string, any>,
  { default: { rows: ReadonlyArray<Row> } }
> {}
