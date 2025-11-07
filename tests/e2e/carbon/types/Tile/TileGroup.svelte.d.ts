import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type TileGroupContext = {
  selectedValue: any;
  add: (arg: any) => any;
  update: (value: any) => any;
};

type $RestProps = SvelteHTMLElements["fieldset"];

type $Props = {
  /**
   * Specify the selected tile value
   * @default undefined
   */
  selected?: string;

  /**
   * Set to `true` to disable the tile group
   * @default false
   */
  disabled?: boolean;

  /**
   * Specify the legend text
   * @default ""
   */
  legend?: string;

  [key: `data-${string}`]: any;
};

export type TileGroupProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TileGroup extends SvelteComponentTyped<
  TileGroupProps,
  { select: CustomEvent<any> },
  { default: Record<string, never> }
> {}
