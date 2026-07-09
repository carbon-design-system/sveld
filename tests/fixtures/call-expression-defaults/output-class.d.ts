import { SvelteComponentTyped } from "svelte";

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

export default class CallExpressionDefaults extends SvelteComponentTyped<
  CallExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
