import type { Component } from "svelte";

export declare const version: string;

export type HtmlCommentBeforeScriptProps = {
  /**
   * The label
   * @default ""
   */
  label?: string;
};

export type HtmlCommentBeforeScriptExports = Record<string, never>;

/**
 * A component whose docs sit between its two scripts.
 */
declare const HtmlCommentBeforeScript: Component<
  HtmlCommentBeforeScriptProps,
  HtmlCommentBeforeScriptExports,
  ""
>;
export default HtmlCommentBeforeScript;
