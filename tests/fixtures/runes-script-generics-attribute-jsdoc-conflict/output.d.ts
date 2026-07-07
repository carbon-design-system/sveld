import { SvelteComponentTyped } from "svelte";

interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $Props<Row extends DataTableRow = DataTableRow> = {
  headers: ReadonlyArray<Row>;
  rows: ReadonlyArray<Row>;
} & {
  children?: (this: void, ...args: [{
        headers: ReadonlyArray<Row>;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type RunesScriptGenericsAttributeJsdocConflictProps<Row extends DataTableRow = DataTableRow> = $Props<Row>;

export default class RunesScriptGenericsAttributeJsdocConflict<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  RunesScriptGenericsAttributeJsdocConflictProps<Row>,
  Record<string, any>,
  {
    default: {
      headers: ReadonlyArray<Row>;
      rows: ReadonlyArray<Row>;
    };
  }
> {}
