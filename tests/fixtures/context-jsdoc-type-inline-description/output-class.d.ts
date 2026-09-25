import { SvelteComponentTyped } from "svelte";

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

export default class ContextJsdocTypeInlineDescription extends SvelteComponentTyped<
  ContextJsdocTypeInlineDescriptionProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
