import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $Props<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> = {
  onSelect: Handler;
  rows: ReadonlyArray<Row>;
} & {
  children?: (this: void, ...args: [{
        onSelect: Handler;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type FuzzGenericsArrowTypeCommaProps<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> = $Props<Handler, Row>;

export type FuzzGenericsArrowTypeCommaExports = Record<string, never>;

interface FuzzGenericsArrowTypeCommaComponent {
  new <Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<FuzzGenericsArrowTypeCommaProps<Handler, Row>>
  ): SvelteComponent<FuzzGenericsArrowTypeCommaProps<Handler, Row>> & FuzzGenericsArrowTypeCommaExports;
  <Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: FuzzGenericsArrowTypeCommaProps<Handler, Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<FuzzGenericsArrowTypeCommaProps<Handler, Row>>): void;
  } & FuzzGenericsArrowTypeCommaExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const FuzzGenericsArrowTypeComma: FuzzGenericsArrowTypeCommaComponent;
export default FuzzGenericsArrowTypeComma;
