import { SvelteComponentTyped } from "svelte";

export type ContextValueUnresolvedProps = {
  children?: (this: void) => void;
};

export default class ContextValueUnresolved extends SvelteComponentTyped<
  ContextValueUnresolvedProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
