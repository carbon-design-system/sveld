import { SvelteComponentTyped } from "svelte";

export type RunesPropsBasicProps = {
  /**
   * @default undefined
   */
  title: undefined;

  /**
   * @default 0
   */
  count?: number;
};

export default class RunesPropsBasic extends SvelteComponentTyped<
  RunesPropsBasicProps,
  Record<string, any>,
  Record<string, never>
> {}
