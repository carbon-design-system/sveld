import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

export type GenericsNameNextLineProps<Row extends DataTableRow = DataTableRow, Key extends keyof Row = keyof Row> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  /**
   * @default undefined
   */
  sortKey?: Key | undefined;

  children?: (this: void, ...args: [{
        rows: ReadonlyArray<Row>;
        sortKey: Key | undefined;
      }]) => void;
};

export type GenericsNameNextLineExports = Record<string, never>;

interface GenericsNameNextLineComponent {
  new <Row extends DataTableRow = DataTableRow,
    Key extends keyof Row = keyof Row>(
    options: ComponentConstructorOptions<GenericsNameNextLineProps<Row,Key>>
  ): SvelteComponent<GenericsNameNextLineProps<Row,Key>> & GenericsNameNextLineExports;
  <Row extends DataTableRow = DataTableRow,
    Key extends keyof Row = keyof Row>(
    this: void,
    internals: ComponentInternals,
    props: GenericsNameNextLineProps<Row,Key>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsNameNextLineProps<Row,Key>>): void;
  } & GenericsNameNextLineExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsNameNextLine: GenericsNameNextLineComponent;
export default GenericsNameNextLine;
