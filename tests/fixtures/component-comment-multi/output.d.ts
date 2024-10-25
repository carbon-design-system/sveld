import type { SvelteComponentTyped } from "svelte";

export type ComponentCommentMultiProps = {};

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
