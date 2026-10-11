import type { Component } from "svelte";

export type MergedContext = {
  a: number;
  b: string;
};

export type WidenedContext = {
  c: boolean;
} & Record<string, any>;

export type ContextSpreadProps = {
  children?: (this: void) => void;
};

export type ContextSpreadExports = Record<string, never>;

declare const ContextSpread: Component<
  ContextSpreadProps,
  ContextSpreadExports,
  ""
>;
export default ContextSpread;
