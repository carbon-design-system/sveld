import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsDefaultProps = {
  /**
   * @default undefined
   */
  item: undefined;

  /**
   * @default undefined
   */
  children: undefined;
};

export default class RunesSnippetsDefault extends SvelteComponentTyped<
  RunesSnippetsDefaultProps,
  Record<string, any>,
  { default: { item: any } }
> {}
