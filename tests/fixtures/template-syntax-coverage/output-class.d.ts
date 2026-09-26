import { SvelteComponentTyped } from "svelte";

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

export default class TemplateSyntaxCoverage extends SvelteComponentTyped<
  TemplateSyntaxCoverageProps,
  Record<string, any>,
  { loaded: { count: any } }
> {}
