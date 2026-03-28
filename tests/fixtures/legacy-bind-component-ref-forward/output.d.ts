import { SvelteComponentTyped } from "svelte";

export type LegacyBindComponentRefForwardProps = {
  /**
   * @default null
   */
  listRef?: undefined;
};

export default class LegacyBindComponentRefForward extends SvelteComponentTyped<
  LegacyBindComponentRefForwardProps,
  Record<string, any>,
  Record<string, never>
> {}
