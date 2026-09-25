import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { ButtonProps } from "./Button.svelte";

export interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $RestProps = SvelteHTMLElements["button"];

type $Props<Row extends DataTableRow = DataTableRow> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;

  children?: (this: void, ...args: [{ rows: ReadonlyArray<Row> }]) => void;

  [key: `data-${string}`]: unknown;
};

export type JsdocTagNameNextLineProps<Row extends DataTableRow = DataTableRow> = Omit<$RestProps, keyof ($Props<Row> & ButtonProps)> & Omit<ButtonProps, keyof $Props<Row>> & $Props<Row>;

export type JsdocTagNameNextLineExports = Record<string, never>;

interface JsdocTagNameNextLineComponent {
  new <Row extends DataTableRow = DataTableRow>(
    options: ComponentConstructorOptions<JsdocTagNameNextLineProps<Row>>
  ): SvelteComponent<JsdocTagNameNextLineProps<Row>> & JsdocTagNameNextLineExports;
  <Row extends DataTableRow = DataTableRow>(
    this: void,
    internals: ComponentInternals,
    props: JsdocTagNameNextLineProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<JsdocTagNameNextLineProps<Row>>): void;
  } & JsdocTagNameNextLineExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocTagNameNextLine: JsdocTagNameNextLineComponent;
export default JsdocTagNameNextLine;
