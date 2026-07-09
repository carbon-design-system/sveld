import type { Component } from "svelte";

export type ComponentCommentMultiProps = {
  children?: (this: void) => void;
};

export type ComponentCommentMultiExports = Record<string, never>;

/**
 * @example
 * <div>
 *   Component comment
 * </div>
 */
declare const ComponentCommentMulti: Component<
  ComponentCommentMultiProps,
  ComponentCommentMultiExports,
  ""
>;
export default ComponentCommentMulti;
