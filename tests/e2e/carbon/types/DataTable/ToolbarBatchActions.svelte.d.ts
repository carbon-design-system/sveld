import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Override the total items selected text
   * @default (totalSelected) => `${totalSelected} item${totalSelected === 1 ? "" : "s"} selected`
   */
  formatTotalSelected?: (totalSelected: number) => string;

  [key: `data-${string}`]: any;
};

export type ToolbarBatchActionsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ToolbarBatchActions extends SvelteComponentTyped<
  ToolbarBatchActionsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
