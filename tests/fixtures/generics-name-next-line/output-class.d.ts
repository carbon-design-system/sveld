import { SvelteComponentTyped } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type GenericsNameNextLineProps<Row extends DataTableRow = DataTableRow, Key extends keyof Row = keyof Row> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  /**
   * @default undefined
   */
  sortKey?: Key | undefined;

  children?: (this: void, ...args: [{
        rows: ReadonlyArray<Row>;
        sortKey: Key | undefined;
      }]) => void;
};

export default class GenericsNameNextLine<Row extends DataTableRow = DataTableRow,
  Key extends keyof Row = keyof Row> extends SvelteComponentTyped<
  GenericsNameNextLineProps<Row,Key>,
  Record<string, any>,
  {
    default: {
      rows: ReadonlyArray<Row>;
      sortKey: Key | undefined;
    };
  }
> {}
