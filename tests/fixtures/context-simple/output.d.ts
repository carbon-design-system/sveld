import { SvelteComponentTyped } from "svelte";

export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};

export type ContextSimpleProps = {
  children?: (this: void) => void;
};

export default class ContextSimple extends SvelteComponentTyped<
  ContextSimpleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
