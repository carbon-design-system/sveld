import { SvelteComponentTyped } from "svelte";

export type ExportSpecifierReactiveProps = {
  /**
   * @default "a"
   */
  variant?: string;

  /**
   * @default false
   */
  open?: boolean;

  /**
   * @default 0
   */
  count?: number;
};

export default class ExportSpecifierReactive extends SvelteComponentTyped<
  ExportSpecifierReactiveProps,
  Record<string, any>,
  Record<string, never>
> {}
