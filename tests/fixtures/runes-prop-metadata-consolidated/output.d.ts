import { SvelteComponentTyped } from "svelte";

export type RunesPropMetadataConsolidatedProps = {
  /**
   * @default "primary"
   */
  class?: string;

  /**
   * @default 0
   */
  value?: number;

  /**
   * @default undefined
   */
  open: undefined;

  /**
   * @default [1, 2]
   */
  items?: [1, 2];

  /**
   * @default { dense: true }
   */
  options?: { dense: true };

  onaction?: (...args: any[]) => any;

  /**
   * @default createDefault()
   */
  computed?: undefined;

  /**
   * @default undefined
   */
  bare: undefined;
};

export default class RunesPropMetadataConsolidated extends SvelteComponentTyped<
  RunesPropMetadataConsolidatedProps,
  Record<string, any>,
  Record<string, never>
> {}
