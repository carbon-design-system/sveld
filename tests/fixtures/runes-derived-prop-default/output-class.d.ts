import { SvelteComponentTyped } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default $derived(now.toISOString())
   */
  label?: any;
};

export default class RunesDerivedPropDefault extends SvelteComponentTyped<
  RunesDerivedPropDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
