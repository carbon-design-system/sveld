import type { Component } from "svelte";

export declare function helper(): any;

export declare const value: number;

export type ExportSpecifierNestedShadowProps = {
  /**
   * @default true
   */
  label?: boolean;

  /**
   * @default 1
   */
  size?: number;
};

export type ExportSpecifierNestedShadowExports = Record<string, never>;

declare const ExportSpecifierNestedShadow: Component<
  ExportSpecifierNestedShadowProps,
  ExportSpecifierNestedShadowExports,
  ""
>;
export default ExportSpecifierNestedShadow;
