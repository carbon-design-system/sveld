import { SvelteComponentTyped } from "svelte";

interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $Props<Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never> = {
  headers: ReadonlyArray<Row>;
  rows: ReadonlyArray<Row>;
  key?: K;
} & {
  children?: (this: void, ...args: [{ headers: ReadonlyArray<Row>, rows: ReadonlyArray<Row> }]) => void;
};

export type RunesScriptGenericsAttributeMultipleProps<Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never> = $Props<Row, K>;

export default class RunesScriptGenericsAttributeMultiple<Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never> extends SvelteComponentTyped<
  RunesScriptGenericsAttributeMultipleProps<Row, K>,
  Record<string, any>,
  { default: { headers: ReadonlyArray<Row>, rows: ReadonlyArray<Row> } }
> {}
