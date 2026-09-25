import { SvelteComponentTyped } from "svelte";

type ModalAPI = { open: () => void };

/**
 * Opens the modal
 */
export type ModalContext = ModalAPI;

export type DrawerContext = {
  /** Closes the drawer */
  close: () => void;
};

export type SecretContext = string;

export type ContextTsAnnotationDescriptionProps = {
  /**
   * The dialog's title.
   * @default ""
   */
  title?: string;

  children?: (this: void) => void;
};

export default class ContextTsAnnotationDescription extends SvelteComponentTyped<
  ContextTsAnnotationDescriptionProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
