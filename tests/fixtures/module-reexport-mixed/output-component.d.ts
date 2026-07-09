import type { Component } from "svelte";

/**
 * A local utility function for formatting
 */
export declare function formatValue(value: any): string;

/**
 * Application version number
 */
export declare const VERSION: string;

/**
 * Logger function
 */
export declare function log(msg: string): void;

export type ModuleReexportMixedProps = {
  /**
   * Item name to display
   * @default undefined
   */
  name: undefined;

  /**
   * Optional item value
   * @default null
   */
  value?: undefined;
};

export type ModuleReexportMixedExports = Record<string, never>;

declare const ModuleReexportMixed: Component<
  ModuleReexportMixedProps,
  ModuleReexportMixedExports,
  ""
>;
export default ModuleReexportMixed;
