import type { Component } from "svelte";

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

export type ContextTsAnnotationDescriptionExports = Record<string, never>;

declare const ContextTsAnnotationDescription: Component<
  ContextTsAnnotationDescriptionProps,
  ContextTsAnnotationDescriptionExports,
  ""
>;
export default ContextTsAnnotationDescription;
