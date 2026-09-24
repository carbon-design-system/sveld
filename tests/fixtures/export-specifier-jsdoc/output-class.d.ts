import { SvelteComponentTyped } from "svelte";

/**
 * Label doc
 */
export declare const label: "a" | "b";

export type ExportSpecifierJsdocProps = {
  /**
   * @default "x"
   */
  variant?: "x" | "y";

  /**
   * Size doc
   * @default 1
   */
  size?: number;

  /**
   * @default 1
   */
  count?: number;

  /**
   * @default "x"
   */
  title?: string;

  /**
   * The panel state
   * @default "open"
   */
  state?: "open" | "closed";
};

export default class ExportSpecifierJsdoc extends SvelteComponentTyped<
  ExportSpecifierJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
