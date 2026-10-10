import { SvelteComponentTyped } from "svelte";

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

export default class EmptyCollectionDefaults extends SvelteComponentTyped<
  EmptyCollectionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
