import { SvelteComponentTyped } from "svelte";

export type ModalContext = {
  open: (component: any, props: any) => any;
  close: () => any;
};

export type ContextInlineFunctionsProps = {
  children?: (this: void) => void;
};

export default class ContextInlineFunctions extends SvelteComponentTyped<
  ContextInlineFunctionsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
