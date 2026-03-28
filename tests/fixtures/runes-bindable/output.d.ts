import { SvelteComponentTyped } from "svelte";

export type RunesBindableProps = {
  /**
   * @default 0
   */
  value?: number;
};

export default class RunesBindable extends SvelteComponentTyped<
  RunesBindableProps,
  Record<string, any>,
  Record<string, never>
> {}
