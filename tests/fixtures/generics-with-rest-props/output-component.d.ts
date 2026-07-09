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

export type GenericsWithRestPropsProps<Row extends DataTableRow = DataTableRow> = Omit<$RestProps, keyof $Props<Row>> & $Props<Row>;

export type GenericsWithRestPropsExports = Record<string, never>;

interface GenericsWithRestPropsComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<GenericsWithRestPropsProps<Row>>
  ): SvelteComponent<GenericsWithRestPropsProps<Row>> & GenericsWithRestPropsExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: GenericsWithRestPropsProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsWithRestPropsProps<Row>>): void;
  } & GenericsWithRestPropsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsWithRestProps: GenericsWithRestPropsComponent;
export default GenericsWithRestProps;
