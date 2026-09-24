import type { Component } from "svelte";

/**
 * Default glob
 */
export declare const pattern: string;

export type CommentCloseInTextProps = {
  /**
   * Glob to match
   * @default "src/**\/*.svelte"
   */
  glob?: string;

  /**
   * Cron schedule
   * @default "*\/5 * * * *"
   */
  cron?: string;

  /**
   * @default /a*\/g
   */
  re?: object;
};

export type CommentCloseInTextExports = {
  fallback: string;
};

/**
 * Renders files matching `src/**\/*.svelte`.
 */
declare const CommentCloseInText: Component<
  CommentCloseInTextProps,
  CommentCloseInTextExports,
  ""
>;
export default CommentCloseInText;
