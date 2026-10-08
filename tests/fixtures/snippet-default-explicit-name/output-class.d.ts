import { SvelteComponentTyped } from "svelte";

export type SnippetDefaultExplicitNameProps = {
  /** Body content. */
  children?: (this: void) => void;
};

export default class SnippetDefaultExplicitName extends SvelteComponentTyped<
  SnippetDefaultExplicitNameProps,
  Record<string, any>,
  {
    /** Body content. */
    default: Record<string, never>;
  }
> {}
