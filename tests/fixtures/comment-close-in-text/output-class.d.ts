import { SvelteComponentTyped } from "svelte";

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

/**
 * Renders files matching `src/**\/*.svelte`.
 */
export default class CommentCloseInText extends SvelteComponentTyped<
  CommentCloseInTextProps,
  Record<string, any>,
  Record<string, never>
> {
  fallback: string;
}
