import type { Component } from "svelte";

export type EmptyCollectionDefaultsProps = {
  /**
   * @default []
   */
  items?: any[];

  /**
   * @default {}
   */
  config?: {};

  /**
   * @default []
   */
  names?: string[];

  /**
   * @default {}
   */
  settings?: { enabled: boolean };

  /**
   * @default { items: [], meta: {} }
   */
  nested?: {
    items: any[];
    meta: {}
  };
};

export type EmptyCollectionDefaultsExports = Record<string, never>;

declare const EmptyCollectionDefaults: Component<
  EmptyCollectionDefaultsProps,
  EmptyCollectionDefaultsExports,
  ""
>;
export default EmptyCollectionDefaults;
