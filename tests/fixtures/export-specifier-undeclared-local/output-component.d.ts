import type { Component } from "svelte";

export type ExportSpecifierUndeclaredLocalProps = {
  /**
   * @default 1
   */
  count?: number;

  /**
   * @default "Count: " + count
   */
  label?: string;
};

export type ExportSpecifierUndeclaredLocalExports = {
  shared: string;
};

declare const ExportSpecifierUndeclaredLocal: Component<
  ExportSpecifierUndeclaredLocalProps,
  ExportSpecifierUndeclaredLocalExports,
  ""
>;
export default ExportSpecifierUndeclaredLocal;
