import { SvelteComponentTyped } from "svelte";

export type ComponentCommentSingleProps = Record<string, never>;

/** Component comment */
export default class ComponentCommentSingle extends SvelteComponentTyped<
  ComponentCommentSingleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
