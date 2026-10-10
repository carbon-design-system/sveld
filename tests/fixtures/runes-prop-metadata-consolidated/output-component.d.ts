import type { Component } from "svelte";

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

export type RunesPropMetadataConsolidatedExports = Record<string, never>;

declare const RunesPropMetadataConsolidated: Component<
  RunesPropMetadataConsolidatedProps,
  RunesPropMetadataConsolidatedExports,
  "value" | "open"
>;
export default RunesPropMetadataConsolidated;
