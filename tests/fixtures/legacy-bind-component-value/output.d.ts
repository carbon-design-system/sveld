import { SvelteComponentTyped } from "svelte";

export type LegacyBindComponentValueProps = {
  /**
   * @default ""
   */
  value?: string;
};

export default class LegacyBindComponentValue extends SvelteComponentTyped<
  LegacyBindComponentValueProps,
  Record<string, any>,
  Record<string, never>
> {}
