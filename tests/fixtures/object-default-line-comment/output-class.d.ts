import { SvelteComponentTyped } from "svelte";

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

export default class ObjectDefaultLineComment extends SvelteComponentTyped<
  ObjectDefaultLineCommentProps,
  Record<string, any>,
  Record<string, never>
> {}
