import type { Component } from "svelte";

export type ObjectDefaultLineCommentProps = {
  /**
   * Spacing scale
   * @default { small: 4, // px large: 16 /* px *\/, }
   */
  spacing?: {
    small: number;
    large: number
  };

  /**
   * Breakpoints
   * @default [ 320, // phone 768, ]
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
