import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row = DataTableRow, Header = DataTableRow> {
  key: DataTableKey<Row>;
  value: Header;
}

export type GenericsMultipleProps<Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow> = {
  /**
   * @default []
   */
  headers?: ReadonlyArray<DataTableHeader<Row, Header>>;

  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (this: void, ...args: [{
        headers: ReadonlyArray<DataTableHeader<Row, Header>>;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type GenericsMultipleExports = Record<string, never>;

interface GenericsMultipleComponent {
  new <Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<GenericsMultipleProps<Row,Header>>
  ): SvelteComponent<GenericsMultipleProps<Row,Header>> & GenericsMultipleExports;
  <Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: GenericsMultipleProps<Row,Header>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsMultipleProps<Row,Header>>): void;
  } & GenericsMultipleExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsMultiple: GenericsMultipleComponent;
export default GenericsMultiple;
