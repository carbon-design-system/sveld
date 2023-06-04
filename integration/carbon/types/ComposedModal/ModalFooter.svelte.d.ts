/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface ModalFooterProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["div"]> {
  /**
   * Specify the primary button text
   * @default ""
   */
  primaryButtonText?: string;

  /**
   * Set to `true` to disable the primary button
   * @default false
   */
  primaryButtonDisabled?: boolean;

  /**
   * Specify a class for the primary button
   * @default undefined
   */
  primaryClass?: string;

  /**
   * Specify the secondary button text
   * @default ""
   */
  secondaryButtonText?: string;

  /**
   * Specify a class for the secondary button
   * @default undefined
   */
  secondaryClass?: string;

  /**
   * Set to `true` to use the danger variant
   * @default false
   */
  danger?: boolean;

  [key: `data-${string}`]: any;
}

export default class ModalFooter extends SvelteComponentTyped<
  ModalFooterProps,
  {},
  { default: {} }
> {}
