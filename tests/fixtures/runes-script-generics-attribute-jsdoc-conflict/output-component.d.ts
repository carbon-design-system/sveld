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

export type RunesScriptGenericsAttributeJsdocConflictProps<Row extends DataTableRow = DataTableRow> = $Props<Row>;

export type RunesScriptGenericsAttributeJsdocConflictExports = Record<string, never>;

interface RunesScriptGenericsAttributeJsdocConflictComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<RunesScriptGenericsAttributeJsdocConflictProps<Row>>
  ): SvelteComponent<RunesScriptGenericsAttributeJsdocConflictProps<Row>> & RunesScriptGenericsAttributeJsdocConflictExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: RunesScriptGenericsAttributeJsdocConflictProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesScriptGenericsAttributeJsdocConflictProps<Row>>): void;
  } & RunesScriptGenericsAttributeJsdocConflictExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesScriptGenericsAttributeJsdocConflict: RunesScriptGenericsAttributeJsdocConflictComponent;
export default RunesScriptGenericsAttributeJsdocConflict;
