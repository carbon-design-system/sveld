import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["td"] & SvelteHTMLElements["th"];

type $Props = {
  /**
   * @default "td"
   */
  cellType?: "td" | "th";

  [key: `data-${string}`]: any;
};

export type ElementTagMapTableCellsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ElementTagMapTableCells extends SvelteComponentTyped<
  ElementTagMapTableCellsProps,
  Record<string, any>,
  Record<string, never>
> {}
