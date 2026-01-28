import { SvelteComponentTyped } from "svelte";

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
  nested?: { items: []; meta: {} };
};

export default class EmptyCollectionDefaults extends SvelteComponentTyped<
  EmptyCollectionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
