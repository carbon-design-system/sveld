import type { Component } from "svelte";

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

export type ObjectDefaultLiteralTextExports = Record<string, never>;

declare const ObjectDefaultLiteralText: Component<
  ObjectDefaultLiteralTextProps,
  ObjectDefaultLiteralTextExports,
  ""
>;
export default ObjectDefaultLiteralText;
