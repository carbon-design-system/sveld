import { SvelteComponentTyped } from "svelte";

export type ComponentCommentSingleProps = {
  children?: (this: void) => void;
};

/** Component comment */
export default class ComponentCommentSingle extends SvelteComponentTyped<
  ComponentCommentSingleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
