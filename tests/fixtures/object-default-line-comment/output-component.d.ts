import type { Component } from "svelte";

export type ObjectDefaultLineCommentProps = {
  /**
   * Spacing scale
   * @default { small: 4, large: 16 , }
   */
  spacing?: {
    small: number;
    large: number
  };

  /**
   * Breakpoints
   * @default [ 320, 768, ]
   */
  breakpoints?: number[];
};

export type ObjectDefaultLineCommentExports = Record<string, never>;

declare const ObjectDefaultLineComment: Component<
  ObjectDefaultLineCommentProps,
  ObjectDefaultLineCommentExports,
  ""
>;
export default ObjectDefaultLineComment;
