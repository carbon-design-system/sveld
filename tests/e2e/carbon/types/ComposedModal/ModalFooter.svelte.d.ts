import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
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
};

export type ModalFooterProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class ModalFooter extends SvelteComponentTyped<
  ModalFooterProps,
  Record<string, any>,
  { default: {} }
> {}
