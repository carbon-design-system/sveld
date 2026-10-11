import { SvelteComponentTyped } from "svelte";

export type ModalContext = {
  open: (component: any, props: any) => void;
  close: () => void;
  select: (id: string, focus: boolean) => void;
};

export type ContextInlineFunctionsProps = {
  children?: (this: void) => void;
};

export default class ContextInlineFunctions extends SvelteComponentTyped<
  ContextInlineFunctionsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
