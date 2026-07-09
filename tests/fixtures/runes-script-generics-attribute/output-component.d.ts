import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type RunesScriptGenericsAttributeProps<Row extends DataTableRow = DataTableRow> = $Props<Row>;

export type RunesScriptGenericsAttributeExports = Record<string, never>;

interface RunesScriptGenericsAttributeComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<RunesScriptGenericsAttributeProps<Row>>
  ): SvelteComponent<RunesScriptGenericsAttributeProps<Row>> & RunesScriptGenericsAttributeExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: RunesScriptGenericsAttributeProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesScriptGenericsAttributeProps<Row>>): void;
  } & RunesScriptGenericsAttributeExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesScriptGenericsAttribute: RunesScriptGenericsAttributeComponent;
export default RunesScriptGenericsAttribute;
