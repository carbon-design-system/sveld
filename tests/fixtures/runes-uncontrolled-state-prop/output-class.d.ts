import { SvelteComponentTyped } from "svelte";

export type RunesUncontrolledStatePropProps = {
  /**
   * @default 0
   */
  count?: number;
};

export default class RunesUncontrolledStateProp extends SvelteComponentTyped<
  RunesUncontrolledStatePropProps,
  Record<string, any>,
  Record<string, never>
> {}
