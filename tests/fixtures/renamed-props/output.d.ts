import type { SvelteComponentTyped } from "svelte";

export type RenamedPropsProps = {
  /**
   * Just your average CSS class string.
   * @default "test"
   */
  class?: string | null;
};

export default class RenamedProps extends SvelteComponentTyped<
  RenamedPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
