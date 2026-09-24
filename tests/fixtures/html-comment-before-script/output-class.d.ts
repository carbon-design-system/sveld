import { SvelteComponentTyped } from "svelte";

export declare const version: string;

export type HtmlCommentBeforeScriptProps = {
  /**
   * The label
   * @default ""
   */
  label?: string;
};

/**
 * A component whose docs sit between its two scripts.
 */
export default class HtmlCommentBeforeScript extends SvelteComponentTyped<
  HtmlCommentBeforeScriptProps,
  Record<string, any>,
  Record<string, never>
> {}
