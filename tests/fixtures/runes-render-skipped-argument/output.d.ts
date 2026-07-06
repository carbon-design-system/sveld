import { SvelteComponentTyped } from "svelte";

export type RunesRenderSkippedArgumentProps = {
  /**
   * @default undefined
   */
  title: undefined;
};

export default class RunesRenderSkippedArgument extends SvelteComponentTyped<
  RunesRenderSkippedArgumentProps,
  Record<string, any>,
  Record<string, never>
> {}
