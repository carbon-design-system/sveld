import { SvelteComponentTyped } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default $derived(now.toISOString())
   */
  label?: any;

  /**
   * @default $derived(uniqueId())
   */
  theId?: string;

  /**
   * @default $state(0)
   */
  theCount?: number;
};

export default class RunesDerivedPropDefault extends SvelteComponentTyped<
  RunesDerivedPropDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
