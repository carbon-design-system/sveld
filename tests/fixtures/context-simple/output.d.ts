import { SvelteComponentTyped } from "svelte";

export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};

export type ContextSimpleProps = Record<string, never>;

export default class ContextSimple extends SvelteComponentTyped<
  ContextSimpleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
