import { SvelteComponentTyped } from "svelte";

export declare const count: number;

export declare const unit: string;

export type ExportSpecifierListProps = {
  /**
   * @default "primary"
   */
  variant?: string;

  /**
   * @default 1
   */
  size?: number;
};

export default class ExportSpecifierList extends SvelteComponentTyped<
  ExportSpecifierListProps,
  Record<string, any>,
  Record<string, never>
> {}
