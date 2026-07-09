import type { Component } from "svelte";

export type PropMetadataConsolidatedProps = {
  /**
   * @default undefined
   */
  typed: string;

  /**
   * JSDoc wins over default inference.
   * @default 1
   */
  documented?: number;

  /**
   * @default "md"
   */
  literalDefault?: string;

  /**
   * @default true
   */
  boolDefault?: boolean;

  /**
   * @default [1, "two", false]
   */
  arrayDefault?: [1, "two", false];

  /**
   * @default { size: "md", count: 2 }
   */
  objectDefault?: { size: "md", count: 2 };

  callbackDefault?: (value: any) => any;

  /**
   * @default makeDefault()
   */
  callDefault?: undefined;

  /**
   * @default Number.MAX_VALUE
   */
  memberDefault?: number;

  /**
   * @default count + 1
   */
  expressionDefault?: number;

  /**
   * @default undefined
   */
  unknown: undefined;
};

export type PropMetadataConsolidatedExports = Record<string, never>;

declare const PropMetadataConsolidated: Component<
  PropMetadataConsolidatedProps,
  PropMetadataConsolidatedExports,
  ""
>;
export default PropMetadataConsolidated;
