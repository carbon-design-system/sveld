import type { Component } from "svelte";

export type CallExpressionDefaultsProps = {
  /**
   * @default generateId()
   */
  id?: string;

  /**
   * @default Date.now()
   */
  timestamp?: number;

  /**
   * @default JSON.parse('{"version": 1}')
   */
  config?: { version: number };

  /**
   * @default "hello".toUpperCase()
   */
  uppercased?: string;

  /**
   * @default uniqueId()
   */
  hoisted?: string;

  /**
   * @default exportedId()
   */
  hoistedExport?: string;

  /**
   * @default helper()
   */
  blockScoped?: any;
};

export type CallExpressionDefaultsExports = {
  exportedId: () => string;
};

declare const CallExpressionDefaults: Component<
  CallExpressionDefaultsProps,
  CallExpressionDefaultsExports,
  ""
>;
export default CallExpressionDefaults;
