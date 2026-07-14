import { SvelteComponentTyped } from "svelte";

export type RealTypedef = {
  name: string;
};

export type StyleBlockJsdocCommentIgnoredProps = {
  /**
   * @default { name: "hello" }
   */
  real?: RealTypedef;
};

export default class StyleBlockJsdocCommentIgnored extends SvelteComponentTyped<
  StyleBlockJsdocCommentIgnoredProps,
  Record<string, any>,
  Record<string, never>
> {}
