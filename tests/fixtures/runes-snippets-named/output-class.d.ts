import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsNamedProps = {
  item: any;

  header?: (this: void, ...args: [{ title: any }]) => void;
};

export default class RunesSnippetsNamed extends SvelteComponentTyped<
  RunesSnippetsNamedProps,
  Record<string, any>,
  { header: { title: any } }
> {}
