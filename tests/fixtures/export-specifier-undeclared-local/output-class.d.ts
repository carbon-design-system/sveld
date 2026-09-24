import { SvelteComponentTyped } from "svelte";

export type ExportSpecifierUndeclaredLocalProps = {
  /**
   * @default 1
   */
  count?: number;

  /**
   * @default "Count: " + count
   */
  label?: string;
};

export default class ExportSpecifierUndeclaredLocal extends SvelteComponentTyped<
  ExportSpecifierUndeclaredLocalProps,
  Record<string, any>,
  Record<string, never>
> {
  shared: string;
}
