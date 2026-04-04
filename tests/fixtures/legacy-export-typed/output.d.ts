import { SvelteComponentTyped } from "svelte";

export type LegacyExportTypedProps = {
  /**
   * @default undefined
   */
  title: string;

  /**
   * @default 0
   */
  count?: number;
};

export default class LegacyExportTyped extends SvelteComponentTyped<
  LegacyExportTypedProps,
  Record<string, any>,
  Record<string, never>
> {}
