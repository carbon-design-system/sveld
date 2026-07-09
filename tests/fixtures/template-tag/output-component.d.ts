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

export type TemplateTagProps<Row extends DataTableRow = DataTableRow> = {
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

export type TemplateTagExports = Record<string, never>;

interface TemplateTagComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<TemplateTagProps<Row>>
  ): SvelteComponent<TemplateTagProps<Row>> & TemplateTagExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: TemplateTagProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TemplateTagProps<Row>>): void;
  } & TemplateTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TemplateTag: TemplateTagComponent;
export default TemplateTag;
