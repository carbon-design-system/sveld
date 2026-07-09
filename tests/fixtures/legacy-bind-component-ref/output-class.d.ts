import { SvelteComponentTyped } from "svelte";

export type LegacyBindComponentRefProps = {
  /**
   * @default null
   */
  ref?: undefined;
};

export default class LegacyBindComponentRef extends SvelteComponentTyped<
  LegacyBindComponentRefProps,
  Record<string, any>,
  Record<string, never>
> {}
