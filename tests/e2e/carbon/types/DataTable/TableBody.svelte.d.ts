import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["tbody"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type TableBodyProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class TableBody extends SvelteComponentTyped<
  TableBodyProps,
  Record<string, any>,
  { default: {} }
> {}
