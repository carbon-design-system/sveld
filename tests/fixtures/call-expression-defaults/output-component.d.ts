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
};

export type CallExpressionDefaultsExports = Record<string, never>;

declare const CallExpressionDefaults: Component<
  CallExpressionDefaultsProps,
  CallExpressionDefaultsExports,
  ""
>;
export default CallExpressionDefaults;
