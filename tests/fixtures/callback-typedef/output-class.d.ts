import { SvelteComponentTyped } from "svelte";

export type SortDirection = "asc" | "desc";

export type SortFn = (a: any, b: any, direction: SortDirection) => number;

export type CallbackTypedefProps = {
  /**
   * @default "asc"
   */
  direction?: SortDirection;

  sort?: SortFn;
};

export default class CallbackTypedef extends SvelteComponentTyped<
  CallbackTypedefProps,
  Record<string, any>,
  Record<string, never>
> {}
