import type { Component } from "svelte";

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

export type LegacyMultiDeclaratorExports = Record<string, never>;

declare const LegacyMultiDeclarator: Component<
  LegacyMultiDeclaratorProps,
  LegacyMultiDeclaratorExports,
  ""
>;
export default LegacyMultiDeclarator;
