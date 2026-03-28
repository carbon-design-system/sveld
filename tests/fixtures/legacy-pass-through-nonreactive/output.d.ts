import { SvelteComponentTyped } from "svelte";

export type LegacyPassThroughNonreactiveProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export default class LegacyPassThroughNonreactive extends SvelteComponentTyped<
  LegacyPassThroughNonreactiveProps,
  Record<string, any>,
  Record<string, never>
> {}
