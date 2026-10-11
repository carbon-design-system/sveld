import { SvelteComponentTyped } from "svelte";

export type RunesExplicitDefaultProps = {
  /**
   * Element id.
   * @default A generated `ccs-` id
   */
  id?: any;

  /**
   * @default 5
   */
  retries?: number;
};

export default class RunesExplicitDefault extends SvelteComponentTyped<
  RunesExplicitDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
