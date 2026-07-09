import type { Component } from "svelte";

export type SortDirection = "asc" | "desc";

export type SortFn = (a: any, b: any, direction: SortDirection) => number;

export type CallbackTypedefProps = {
  /**
   * @default "asc"
   */
  direction?: SortDirection;

  sort?: SortFn;
};

export type CallbackTypedefExports = Record<string, never>;

declare const CallbackTypedef: Component<
  CallbackTypedefProps,
  CallbackTypedefExports,
  ""
>;
export default CallbackTypedef;
