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

  open?: any;

  /**
   * @default [1, 2]
   */
  items?: number[];

  /**
   * @default { dense: true }
   */
  options?: { dense: boolean };

  /**
   * @default () => {}
   */
  onaction?: (...args: any[]) => any;

  /**
   * @default createDefault()
   */
  computed?: string;

  bare: any;
};

export default class RunesPropMetadataConsolidated extends SvelteComponentTyped<
  RunesPropMetadataConsolidatedProps,
  Record<string, any>,
  Record<string, never>
> {}
