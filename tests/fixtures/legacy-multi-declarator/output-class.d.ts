import { SvelteComponentTyped } from "svelte";

export type LegacyMultiDeclaratorProps = {
  /**
   * Block description applies to every declarator below.
   * @default 1
   */
  a?: number;

  /**
   * Block description applies to every declarator below.
   * @default 2
   */
  b?: number;

  /**
   * Block description applies to every declarator below.
   */
  c: any;
};

export default class LegacyMultiDeclarator extends SvelteComponentTyped<
  LegacyMultiDeclaratorProps,
  Record<string, any>,
  Record<string, never>
> {}
