import { SvelteComponentTyped } from "svelte";

export type ReactiveDirectMutationStillTrueProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export default class ReactiveDirectMutationStillTrue extends SvelteComponentTyped<
  ReactiveDirectMutationStillTrueProps,
  Record<string, any>,
  Record<string, never>
> {}
