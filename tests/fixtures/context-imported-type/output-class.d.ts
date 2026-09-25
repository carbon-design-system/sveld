import { SvelteComponentTyped } from "svelte";

export type ModalAPI = {
  open: () => void;
  close: () => void;
};

/**
 * Modal API object
 */
export type ModalContext = ModalAPI;

export type ContextImportedTypeProps = {
  children?: (this: void) => void;
};

export default class ContextImportedType extends SvelteComponentTyped<
  ContextImportedTypeProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
