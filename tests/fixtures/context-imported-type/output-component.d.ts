import type { Component } from "svelte";

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

export type ContextImportedTypeExports = Record<string, never>;

declare const ContextImportedType: Component<
  ContextImportedTypeProps,
  ContextImportedTypeExports,
  ""
>;
export default ContextImportedType;
