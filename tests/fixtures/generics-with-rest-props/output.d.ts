import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row = DataTableRow> {
  key: DataTableKey<Row>;
  value: string;
}

type $RestProps = SvelteHTMLElements["div"];

type $Props<Row> = {
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

  [key: `data-${string}`]: any;
};

export type GenericsWithRestPropsProps<Row> = Omit<$RestProps, keyof $Props<Row>> & $Props<Row>;

export default class GenericsWithRestProps<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  GenericsWithRestPropsProps<Row>,
  Record<string, any>,
  { default: { headers: ReadonlyArray<DataTableHeader<Row>>; rows: ReadonlyArray<Row> } }
> {}
