import type { Component } from "svelte";

export type EmptyCollectionDefaultsProps = {
  /**
   * @default []
   */
  items?: [];

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
  nested?: { items: [], meta: {} };
};

export type EmptyCollectionDefaultsExports = Record<string, never>;

declare const EmptyCollectionDefaults: Component<
  EmptyCollectionDefaultsProps,
  EmptyCollectionDefaultsExports,
  ""
>;
export default EmptyCollectionDefaults;
