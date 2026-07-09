import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

  children?: (this: void, ...args: [{
        headers: ReadonlyArray<DataTableHeader<Row>>;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type RunesGenericsExports = Record<string, never>;

interface RunesGenericsComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<RunesGenericsProps<Row>>
  ): SvelteComponent<RunesGenericsProps<Row>> & RunesGenericsExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: RunesGenericsProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesGenericsProps<Row>>): void;
  } & RunesGenericsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesGenerics: RunesGenericsComponent;
export default RunesGenerics;
