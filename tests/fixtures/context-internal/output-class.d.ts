import { SvelteComponentTyped } from "svelte";

export type PublicContext = {
  open: boolean;
};

export type ContextInternalProps = {
  children?: (this: void) => void;
};

export default class ContextInternal extends SvelteComponentTyped<
  ContextInternalProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
