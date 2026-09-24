import type { Component } from "svelte";

export type ExportSpecifierReactiveProps = {
  /**
   * @default "a"
   */
  variant?: string;

  /**
   * @default false
   */
  open?: boolean;

  /**
   * @default 0
   */
  count?: number;
};

export type ExportSpecifierReactiveExports = Record<string, never>;

declare const ExportSpecifierReactive: Component<
  ExportSpecifierReactiveProps,
  ExportSpecifierReactiveExports,
  ""
>;
export default ExportSpecifierReactive;
