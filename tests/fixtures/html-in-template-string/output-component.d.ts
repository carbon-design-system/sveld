import type { Component } from "svelte";

export type HtmlInTemplateStringProps = {
  /**
   * @default "test"
   */
  message?: string;
};

export type HtmlInTemplateStringExports = Record<string, never>;

declare const HtmlInTemplateString: Component<
  HtmlInTemplateStringProps,
  HtmlInTemplateStringExports,
  ""
>;
export default HtmlInTemplateString;
