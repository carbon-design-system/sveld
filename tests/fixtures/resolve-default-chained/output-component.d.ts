import type { Component } from "svelte";

export type ResolveDefaultChainedProps = {
  /**
   * Two levels deep: ALIAS -> ACTUAL_VALUE -> 42.
   * @default 42
   */
  chained?: number;

  /**
   * Five levels deep: E -> D -> C -> B -> A -> "hello". Resolves within the depth limit.
   * @default "hello"
   */
  deep5?: string;

  /**
   * Six levels deep: BEYOND -> Z -> Y -> X -> W -> V -> true. Exceeds the depth limit.
   * @default V
   */
  deep6?: undefined;
};

export type ResolveDefaultChainedExports = Record<string, never>;

declare const ResolveDefaultChained: Component<
  ResolveDefaultChainedProps,
  ResolveDefaultChainedExports,
  ""
>;
export default ResolveDefaultChained;
