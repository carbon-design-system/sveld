import type { Component } from "svelte";

export type Props = {
  /** Card title */
  title: string;
  /** Elevated look @default false */
  elevated?: boolean;
  /** Click handler */
  onclick?: (e: MouseEvent) => void;
};

export type RunesPropsJsdocTypedefProps = {
  /**
   * Card title
   */
  title: string;

  /**
   * Elevated look
   * @default false
   */
  elevated?: boolean;

  /**
   * Click handler
   */
  onclick?: (e: MouseEvent) => void;
};

export type RunesPropsJsdocTypedefExports = Record<string, never>;

declare const RunesPropsJsdocTypedef: Component<
  RunesPropsJsdocTypedefProps,
  RunesPropsJsdocTypedefExports,
  ""
>;
export default RunesPropsJsdocTypedef;
