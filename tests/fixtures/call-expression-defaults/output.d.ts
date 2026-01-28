import { SvelteComponentTyped } from "svelte";

export type CallExpressionDefaultsProps = {
  /**
   * @default undefined
   */
  id?: string;

  /**
   * @default undefined
   */
  timestamp?: number;

  /**
   * @default undefined
   */
  config?: { version: number };

  /**
   * @default undefined
   */
  uppercased?: string;
};

export default class CallExpressionDefaults extends SvelteComponentTyped<
  CallExpressionDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
