import type { Component } from "svelte";

/**
 * Label doc
 */
export declare const label: "a" | "b";

export type ExportSpecifierJsdocProps = {
  /**
   * @default "x"
   */
  variant?: "x" | "y";

  /**
   * Size doc
   * @default 1
   */
  size?: number;

  /**
   * @default 1
   */
  count?: number;

  /**
   * @default "x"
   */
  title?: string;

  /**
   * The panel state
   * @default "open"
   */
  state?: "open" | "closed";
};

export type ExportSpecifierJsdocExports = Record<string, never>;

declare const ExportSpecifierJsdoc: Component<
  ExportSpecifierJsdocProps,
  ExportSpecifierJsdocExports,
  ""
>;
export default ExportSpecifierJsdoc;
