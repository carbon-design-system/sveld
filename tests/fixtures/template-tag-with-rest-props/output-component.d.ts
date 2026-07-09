import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type DataTableKey<Row> = Exclude<keyof Row, "id">;

export interface DataTableHeader<Row = DataTableRow> {
  key: DataTableKey<Row>;
  value: string;
}

type $RestProps = SvelteHTMLElements["div"];

type $Props<Row extends DataTableRow = DataTableRow> = {
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

  [key: `data-${string}`]: unknown;
};

export type TemplateTagWithRestPropsProps<Row extends DataTableRow = DataTableRow> = Omit<$RestProps, keyof $Props<Row>> & $Props<Row>;

export type TemplateTagWithRestPropsExports = Record<string, never>;

interface TemplateTagWithRestPropsComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<TemplateTagWithRestPropsProps<Row>>
  ): SvelteComponent<TemplateTagWithRestPropsProps<Row>> & TemplateTagWithRestPropsExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: TemplateTagWithRestPropsProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TemplateTagWithRestPropsProps<Row>>): void;
  } & TemplateTagWithRestPropsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TemplateTagWithRestProps: TemplateTagWithRestPropsComponent;
export default TemplateTagWithRestProps;
