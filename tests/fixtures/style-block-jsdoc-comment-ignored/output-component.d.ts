import type { Component } from "svelte";

export type RealTypedef = {
  name: string;
};

export type StyleBlockJsdocCommentIgnoredProps = {
  /**
   * @default { name: "hello" }
   */
  real?: RealTypedef;
};

export type StyleBlockJsdocCommentIgnoredExports = Record<string, never>;

declare const StyleBlockJsdocCommentIgnored: Component<
  StyleBlockJsdocCommentIgnoredProps,
  StyleBlockJsdocCommentIgnoredExports,
  ""
>;
export default StyleBlockJsdocCommentIgnored;
