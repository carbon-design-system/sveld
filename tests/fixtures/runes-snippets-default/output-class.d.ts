import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsDefaultProps = {
  item: any;

  children?: (this: void, ...args: [{ item: any }]) => void;
};

export default class RunesSnippetsDefault extends SvelteComponentTyped<
  RunesSnippetsDefaultProps,
  Record<string, any>,
  { default: { item: any } }
> {}
