import { SvelteComponentTyped } from "svelte";

export type RunesSnippetsInferredProps = {
  item: any;

  header?: (this: void, ...args: [{ title: any }]) => void;

  children?: (this: void, ...args: [{ item: any }]) => void;
};

export default class RunesSnippetsInferred extends SvelteComponentTyped<
  RunesSnippetsInferredProps,
  Record<string, any>,
  {
    default: { item: any };
    header: { title: any };
  }
> {}
