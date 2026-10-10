import type { Component } from "svelte";

export type WidenedLiteralDefaultsProps = {
  /**
   * @default { sm: false, md: true }
   */
  sizes?: {
    sm: boolean;
    md: boolean
  };

  /**
   * @default [{ id: 1, label: "a" }]
   */
  rows?: {
    id: number;
    label: string
  }[];

  /**
   * @default [[1, 2], [3]]
   */
  matrix?: number[][];

  /**
   * @default [1, "two", null]
   */
  mixed?: (number | string | null)[];

  /**
   * @default { none: null, missing: undefined, pattern: /a+/, big: 10n, offset: -1, text: `t` }
   */
  members?: {
    none: null;
    missing: undefined;
    pattern: RegExp;
    big: bigint;
    offset: number;
    text: string
  };

  /**
   * @default { "data-id": "x", 0: 1 }
   */
  quoted?: {
    "data-id": string;
    0: number
  };

  /**
   * @default { list: [], map: {} }
   */
  nested?: {
    list: any[];
    map: {}
  };

  /**
   * @default { fallback }
   */
  shorthand?: any;
};

export type WidenedLiteralDefaultsExports = {
  ids: {
    close: "close";
    open: "open"
  };

  steps: [1, -2, `three`, null];
};

declare const WidenedLiteralDefaults: Component<
  WidenedLiteralDefaultsProps,
  WidenedLiteralDefaultsExports,
  ""
>;
export default WidenedLiteralDefaults;
