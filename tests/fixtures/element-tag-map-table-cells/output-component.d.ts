import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["td"] & SvelteHTMLElements["th"];

type $Props = {
  /**
   * @default "td"
   */
  cellType?: "td" | "th";

  [key: `data-${string}`]: unknown;
};

export type ElementTagMapTableCellsProps = Omit<$RestProps, keyof $Props> & $Props;

export type ElementTagMapTableCellsExports = Record<string, never>;

declare const ElementTagMapTableCells: Component<
  ElementTagMapTableCellsProps,
  ElementTagMapTableCellsExports,
  ""
>;
export default ElementTagMapTableCells;
