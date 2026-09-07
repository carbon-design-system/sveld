import { SvelteComponentTyped } from "svelte";

export type RunesPropsBasicProps = {
  title: any;

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
