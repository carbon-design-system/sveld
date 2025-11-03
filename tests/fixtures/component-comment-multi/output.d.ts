import type { SvelteComponentTyped } from "svelte";

export type ComponentCommentMultiProps = Record<string, never>;

/**
 * @example
 * <div>
 *   Component comment
 * </div>
 */
export default class ComponentCommentMulti extends SvelteComponentTyped<
  ComponentCommentMultiProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
