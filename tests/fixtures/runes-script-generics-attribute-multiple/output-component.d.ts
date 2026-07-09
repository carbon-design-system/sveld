import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $Props<Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never> = {
  headers: ReadonlyArray<Row>;
  rows: ReadonlyArray<Row>;
  key?: K;
} & {
  children?: (this: void, ...args: [{
        headers: ReadonlyArray<Row>;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type RunesScriptGenericsAttributeMultipleProps<Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never> = $Props<Row, K>;

export type RunesScriptGenericsAttributeMultipleExports = Record<string, never>;

interface RunesScriptGenericsAttributeMultipleComponent {
  new <Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never>(
    options: ComponentConstructorOptions<RunesScriptGenericsAttributeMultipleProps<Row, K>>
  ): SvelteComponent<RunesScriptGenericsAttributeMultipleProps<Row, K>> & RunesScriptGenericsAttributeMultipleExports;
  <Row extends DataTableRow = DataTableRow, K extends keyof Map<string, Row> = never>(
    this: void,
    internals: ComponentInternals,
    props: RunesScriptGenericsAttributeMultipleProps<Row, K>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesScriptGenericsAttributeMultipleProps<Row, K>>): void;
  } & RunesScriptGenericsAttributeMultipleExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesScriptGenericsAttributeMultiple: RunesScriptGenericsAttributeMultipleComponent;
export default RunesScriptGenericsAttributeMultiple;
