import { SvelteComponentTyped } from "svelte";

export type RunesDerivedPropDefaultResolvedProps = {
  /**
   * @default $derived(uniqueId())
   */
  theId?: string;

  /**
   * @default $state(0)
   */
  theCount?: number;
};

export default class RunesDerivedPropDefaultResolved extends SvelteComponentTyped<
  RunesDerivedPropDefaultResolvedProps,
  Record<string, any>,
  Record<string, never>
> {}
