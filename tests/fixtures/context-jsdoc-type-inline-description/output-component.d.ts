import type { Component } from "svelte";

/**
 * Opens the modal
 */
export type ModalContext = {
  open: () => void;
};

/**
 * Toggles the menu
 * when clicked.
 */
export type MenuContext = {
  toggle: () => void;
};

export type DrawerContext = {
  /** Closes the drawer */
  close: () => void;
};

export type ContextJsdocTypeInlineDescriptionProps = {
  children?: (this: void) => void;
};

export type ContextJsdocTypeInlineDescriptionExports = Record<string, never>;

declare const ContextJsdocTypeInlineDescription: Component<
  ContextJsdocTypeInlineDescriptionProps,
  ContextJsdocTypeInlineDescriptionExports,
  ""
>;
export default ContextJsdocTypeInlineDescription;
