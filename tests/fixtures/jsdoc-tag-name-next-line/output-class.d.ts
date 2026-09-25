import { SvelteComponentTyped } from "svelte";
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

export default class JsdocTagNameNextLine<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  JsdocTagNameNextLineProps<Row>,
  Record<string, any>,
  { default: { rows: ReadonlyArray<Row> } }
> {}
