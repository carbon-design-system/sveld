import { SvelteComponentTyped } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default $derived(now.toISOString())
   */
  label?: undefined;
};

export default class RunesDerivedPropDefault extends SvelteComponentTyped<
  RunesDerivedPropDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
