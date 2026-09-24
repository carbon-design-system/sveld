import type { Component } from "svelte";

export declare const count: number;

export declare const unit: string;

export type ExportSpecifierListProps = {
  /**
   * @default "primary"
   */
  variant?: string;

  /**
   * @default 1
   */
  size?: number;
};

export type ExportSpecifierListExports = Record<string, never>;

declare const ExportSpecifierList: Component<
  ExportSpecifierListProps,
  ExportSpecifierListExports,
  ""
>;
export default ExportSpecifierList;
