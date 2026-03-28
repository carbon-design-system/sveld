import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsNamedProps = {
  /**
   * @default undefined
   */
  item: undefined;

  /**
   * @default undefined
   */
  header: undefined;
};

export default class RunesSnippetsNamed extends SvelteComponentTyped<
  RunesSnippetsNamedProps,
  Record<string, any>,
  { header: { title: any } }
> {}
