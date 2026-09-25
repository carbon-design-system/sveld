import { SvelteComponentTyped } from "svelte";

export type ObjectDefaultLineCommentProps = {
  /**
   * Spacing scale
   * @default { small: 4, // px large: 16 /* px *\/, }
   */
  spacing?: { small: 4, large: 16 , };

  /**
   * Breakpoints
   * @default [ 320, // phone 768, ]
   */
  breakpoints?: [ 320, 768, ];
};

export default class ObjectDefaultLineComment extends SvelteComponentTyped<
  ObjectDefaultLineCommentProps,
  Record<string, any>,
  Record<string, never>
> {}
