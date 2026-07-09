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

export type TemplateTagMultipleProps<Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow> = {
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

export type TemplateTagMultipleExports = Record<string, never>;

interface TemplateTagMultipleComponent {
  new <Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<TemplateTagMultipleProps<Row, Header>>
  ): SvelteComponent<TemplateTagMultipleProps<Row, Header>> & TemplateTagMultipleExports;
  <Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: TemplateTagMultipleProps<Row, Header>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TemplateTagMultipleProps<Row, Header>>): void;
  } & TemplateTagMultipleExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TemplateTagMultiple: TemplateTagMultipleComponent;
export default TemplateTagMultiple;
