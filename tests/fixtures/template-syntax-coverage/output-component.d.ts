import type { Component } from "svelte";

export type TemplateSyntaxCoverageProps = {
  /**
   * @default Promise.resolve([])
   */
  items?: Promise<string[]>;

  /**
   * @default "a"
   */
  selected?: string;

  /**
   * @default 0
   */
  version?: number;

  loaded?: (this: void, ...args: [{ count: any }]) => void;
};

export type TemplateSyntaxCoverageExports = Record<string, never>;

declare const TemplateSyntaxCoverage: Component<
  TemplateSyntaxCoverageProps,
  TemplateSyntaxCoverageExports,
  ""
>;
export default TemplateSyntaxCoverage;
