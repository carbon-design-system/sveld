import { SvelteComponentTyped } from "svelte";

export type ComponentCommentMultiProps = {
  children?: (this: void) => void;
};

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
