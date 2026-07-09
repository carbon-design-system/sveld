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

export type GenericsProps<Row extends DataTableRow = DataTableRow> = {
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

export type GenericsExports = Record<string, never>;

interface GenericsComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<GenericsProps<Row>>
  ): SvelteComponent<GenericsProps<Row>> & GenericsExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: GenericsProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsProps<Row>>): void;
  } & GenericsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const Generics: GenericsComponent;
export default Generics;
