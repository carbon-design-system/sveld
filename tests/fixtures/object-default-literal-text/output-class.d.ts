import { SvelteComponentTyped } from "svelte";

export type ObjectDefaultLiteralTextProps = {
  /**
   * URL patterns
   * @default { url: /https?:\/\//, quote: /"/, }
   */
  patterns?: {
    url: RegExp;
    quote: RegExp
  };

  /**
   * Separators
   * @default [ "  ", "a // b", `one\ntwo`, ]
   */
  separators?: string[];
};

export default class ObjectDefaultLiteralText extends SvelteComponentTyped<
  ObjectDefaultLiteralTextProps,
  Record<string, any>,
  Record<string, never>
> {}
