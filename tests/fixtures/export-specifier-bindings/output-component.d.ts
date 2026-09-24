import type { Component } from "svelte";

export declare function format(): any;

export type ExportSpecifierBindingsProps = {
  /**
   * @default 1
   */
  size?: number;

  x?: any;

  why?: any;

  a?: any;

  b?: any;
};

export type ExportSpecifierBindingsExports = {
  reset: () => any;
};

declare const ExportSpecifierBindings: Component<
  ExportSpecifierBindingsProps,
  ExportSpecifierBindingsExports,
  ""
>;
export default ExportSpecifierBindings;
