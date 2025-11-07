import type { SvelteComponentTyped } from "svelte";

export type ModalContext = {
  open: (component: any, props: any) => any;
  close: () => any;
};

export type ContextInlineFunctionsProps = Record<string, never>;

export default class ContextInlineFunctions extends SvelteComponentTyped<
  ContextInlineFunctionsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
