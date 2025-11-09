import type { SvelteComponentTyped } from "svelte";

/**
 * A local utility function for formatting
 */
export declare function formatValue(value: any): string;

/**
 * Application version number
 */
export type VERSION = string;

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

export default class ModuleReexportMixed extends SvelteComponentTyped<
  ModuleReexportMixedProps,
  Record<string, any>,
  Record<string, never>
> {}
