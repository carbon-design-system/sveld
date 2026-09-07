import type { Component } from "svelte";

export type BindThisProps = {
  ref: null | HTMLButtonElement;

  children?: (this: void) => void;
};

export type BindThisExports = Record<string, never>;

declare const BindThis: Component<
  BindThisProps,
  BindThisExports,
  ""
>;
export default BindThis;
