import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Override the total items selected text
   */
  formatTotalSelected?: (totalSelected: number) => string;

  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type ToolbarBatchActionsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ToolbarBatchActions extends SvelteComponentTyped<
  ToolbarBatchActionsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
