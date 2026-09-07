import { SvelteComponentTyped } from "svelte";

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
   */
  name: any;

  /**
   * Optional item value
   * @default null
   */
  value?: any;
};

export default class ModuleReexportMixed extends SvelteComponentTyped<
  ModuleReexportMixedProps,
  Record<string, any>,
  Record<string, never>
> {}
