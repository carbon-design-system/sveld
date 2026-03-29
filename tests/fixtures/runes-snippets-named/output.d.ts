import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsNamedProps = {
  /**
   * @default undefined
   */
  item: undefined;

  header?: (this: void, ...args: [{ title: any }]) => void;
};

export default class RunesSnippetsNamed extends SvelteComponentTyped<
  RunesSnippetsNamedProps,
  Record<string, any>,
  { header: { title: any } }
> {}
