import type { Component } from "svelte";

export type LegacyReactiveDetectionProps = {
  /**
   * @default false
   */
  reassigned?: boolean;

  /**
   * @default ""
   */
  value?: string;

  /**
   * @default ""
   */
  boundInput?: string;

  /**
   * @default 10
   */
  pageSize?: number;

  /**
   * @default null
   */
  ref?: any;

  /**
   * @default null
   */
  listRef?: any;

  /**
   * @default ["a"]
   */
  values?: string[];

  /**
   * @default { name: "" }
   */
  settings?: { name: string };

  /**
   * @default [{ label: "" }]
   */
  rows?: { label: string }[];

  /**
   * @default false
   */
  passedThrough?: boolean;

  /**
   * @default false
   */
  localShadow?: boolean;

  /**
   * @default false
   */
  paramShadow?: boolean;

  /**
   * @default false
   */
  handlerShadow?: boolean;

  /**
   * @default false
   */
  eachShadow?: boolean;

  /**
   * @default ""
   */
  bindShadow?: string;
};

export type LegacyReactiveDetectionExports = Record<string, never>;

declare const LegacyReactiveDetection: Component<
  LegacyReactiveDetectionProps,
  LegacyReactiveDetectionExports,
  ""
>;
export default LegacyReactiveDetection;
