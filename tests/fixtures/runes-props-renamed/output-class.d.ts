import { SvelteComponentTyped } from "svelte";

export type RunesPropsRenamedProps = {
  /**
   * @default undefined
   */
  class: undefined;
};

export default class RunesPropsRenamed extends SvelteComponentTyped<
  RunesPropsRenamedProps,
  Record<string, any>,
  Record<string, never>
> {}
