import { SvelteComponentTyped } from "svelte";

export type ModalAPI = {
  open: () => void;
  close: () => void;
};

/**
 * Log a message to the console
 */
export type MyLoggerContext = (message: string) => void;

/**
 * Modal API object
 */
export type ModalContext = ModalAPI;

export type ContextTypedValueProps = {
  children?: (this: void) => void;
};

export default class ContextTypedValue extends SvelteComponentTyped<
  ContextTypedValueProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
