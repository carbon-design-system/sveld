import { SvelteComponentTyped } from "svelte";

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

export default class ObjectDefaultLineComment extends SvelteComponentTyped<
  ObjectDefaultLineCommentProps,
  Record<string, any>,
  Record<string, never>
> {}
