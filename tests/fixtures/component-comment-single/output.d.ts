import type { SvelteComponentTyped } from "svelte";

export interface ComponentCommentSingleProps {}

/** Component comment */
export default class ComponentCommentSingle extends SvelteComponentTyped<
  ComponentCommentSingleProps,
  Record<string, any>,
  { default: {} }
> {}
