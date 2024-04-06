import type { SvelteComponentTyped } from "svelte";

export interface ComponentCommentMultiProps {}

/**
 * @example
 * <div>
 *   Component comment
 * </div>
 */
export default class ComponentCommentMulti extends SvelteComponentTyped<
  ComponentCommentMultiProps,
  Record<string, any>,
  { default: {} }
> {}
