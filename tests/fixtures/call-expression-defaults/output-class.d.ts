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

export default class CallExpressionDefaults extends SvelteComponentTyped<
  CallExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {
  exportedId: () => string;
}
