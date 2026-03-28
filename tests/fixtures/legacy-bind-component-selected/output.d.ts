import { SvelteComponentTyped } from "svelte";

export type LegacyBindComponentSelectedProps = {
  /**
   * @default 10
   */
  pageSize?: number;
};

export default class LegacyBindComponentSelected extends SvelteComponentTyped<
  LegacyBindComponentSelectedProps,
  Record<string, any>,
  Record<string, never>
> {}
