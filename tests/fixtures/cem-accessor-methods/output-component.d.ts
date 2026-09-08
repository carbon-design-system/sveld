import type { Component } from "svelte";

export type CemAccessorMethodsProps = Record<string, never>;

export type CemAccessorMethodsExports = {
  version: string;

  setLabel: (label: string) => string;

  getCount: () => number;
};

declare const CemAccessorMethods: Component<
  CemAccessorMethodsProps,
  CemAccessorMethodsExports,
  ""
>;
export default CemAccessorMethods;
