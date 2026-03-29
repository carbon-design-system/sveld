import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsAnnotatedProps = {
  /**
   * @default 0
   */
  prop?: number;

  /** Customize the paragraph text. */
  body?: (this: void, ...args: [{ prop: number }]) => void;

  title?: (this: void) => void;

  children?: (this: void, ...args: [{ prop: number; doubled: number }]) => void;
};

export default class RunesSnippetsAnnotated extends SvelteComponentTyped<
  RunesSnippetsAnnotatedProps,
  Record<string, any>,
  {
    default: { prop: number; doubled: number };
    /** Customize the paragraph text. */
    body: { prop: number };
    title: Record<string, never>;
  }
> {}
