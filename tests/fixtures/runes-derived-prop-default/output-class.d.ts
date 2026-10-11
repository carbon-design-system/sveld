import { SvelteComponentTyped } from "svelte";

export type RunesDerivedPropDefaultProps = {
  /**
   * @default now.toISOString()
   */
  label?: any;

  /**
   * @default uniqueId()
   */
  theId?: string;

  /**
   * @default 0
   */
  theCount?: number;
};

export default class RunesDerivedPropDefault extends SvelteComponentTyped<
  RunesDerivedPropDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
