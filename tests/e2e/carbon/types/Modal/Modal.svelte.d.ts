import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Set the size of the modal
   * @default undefined
   */
  size?: "xs" | "sm" | "lg";

  /**
   * Set to `true` to open the modal
   * @default false
   */
  open?: boolean;

  /**
   * Set to `true` to use the danger variant
   * @default false
   */
  danger?: boolean;

  /**
   * Set to `true` to enable alert mode
   * @default false
   */
  alert?: boolean;

  /**
   * Set to `true` to use the passive variant
   * @default false
   */
  passiveModal?: boolean;

  /**
   * Specify the modal heading
   * @default undefined
   */
  modalHeading?: string;

  /**
   * Specify the modal label
   * @default undefined
   */
  modalLabel?: string;

  /**
   * Specify the ARIA label for the modal
   * @default undefined
   */
  modalAriaLabel?: string;

  /**
   * Specify the ARIA label for the close icon
   * @default "Close the modal"
   */
  iconDescription?: string;

  /**
   * Set to `true` if the modal contains form elements
   * @default false
   */
  hasForm?: boolean;

  /**
   * Set to `true` if the modal contains scrolling content
   * @default false
   */
  hasScrollingContent?: boolean;

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
   * Set to `true` for the primary button to be triggered when pressing "Enter"
   * @default true
   */
  shouldSubmitOnEnter?: boolean;

  /**
   * Specify the secondary button text
   * @default ""
   */
  secondaryButtonText?: string;

  /**
   * Specify a selector to be focused when opening the modal
   * @default "[data-modal-primary-focus]"
   */
  selectorPrimaryFocus?: string;

  /**
   * Set to `true` to prevent the modal from closing when clicking outside
   * @default false
   */
  preventCloseOnClickOutside?: boolean;

  /**
   * Set an id for the top-level element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Obtain a reference to the top-level HTML element
   * @default null
   */
  ref?: null | HTMLDivElement;

  [key: `data-${string}`]: any;
};

export type ModalProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Modal extends SvelteComponentTyped<
  ModalProps,
  {
    keydown: WindowEventMap["keydown"];
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    submit: CustomEvent<null>;
    ["click:button--secondary"]: CustomEvent<null>;
    close: CustomEvent<null>;
    open: CustomEvent<null>;
  },
  { default: {}; heading: {}; label: {} }
> {}
