import type { SvelteComponentTyped } from "svelte";

export type HtmlInTemplateStringProps = {
  /**
   * @default "test"
   */
  message?: string;
};

export default class HtmlInTemplateString extends SvelteComponentTyped<
  HtmlInTemplateStringProps,
  Record<string, any>,
  Record<string, never>
> {}
