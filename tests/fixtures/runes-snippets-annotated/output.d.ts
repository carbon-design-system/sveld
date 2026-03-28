import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsAnnotatedProps = {
  /**
   * @default 0
   */
  prop?: number;

  /**
   * @default undefined
   */
  children: undefined;

  /**
   * @default undefined
   */
  title: undefined;

  /**
   * @default undefined
   */
  body: undefined;
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
