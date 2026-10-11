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

export type GenericsAttributeArrowTypeProps<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> = $Props<Handler, Row>;

export type GenericsAttributeArrowTypeExports = Record<string, never>;

interface GenericsAttributeArrowTypeComponent {
  new <Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<GenericsAttributeArrowTypeProps<Handler, Row>>
  ): SvelteComponent<GenericsAttributeArrowTypeProps<Handler, Row>> & GenericsAttributeArrowTypeExports;
  <Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: GenericsAttributeArrowTypeProps<Handler, Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsAttributeArrowTypeProps<Handler, Row>>): void;
  } & GenericsAttributeArrowTypeExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsAttributeArrowType: GenericsAttributeArrowTypeComponent;
export default GenericsAttributeArrowType;
