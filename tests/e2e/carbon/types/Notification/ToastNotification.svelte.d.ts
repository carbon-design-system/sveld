import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the kind of notification
   * @default "error"
   */
  kind?:
    | "error"
    | "info"
    | "info-square"
    | "success"
    | "warning"
    | "warning-alt";

  /**
   * Set to `true` to use the low contrast variant
   * @default false
   */
  lowContrast?: boolean;

  /**
   * Set the timeout duration (ms) to hide the notification after opening it
   * @default 0
   */
  timeout?: number;

  /**
   * Set the `role` attribute
   * @default "alert"
   */
  role?: string;

  /**
   * Specify the title text
   * @default "Title"
   */
  title?: string;

  /**
   * Specify the subtitle text
   * @default ""
   */
  subtitle?: string;

  /**
   * Specify the caption text
   * @default "Caption"
   */
  caption?: string;

  /**
   * Specify the ARIA label for the icon
   * @default "Closes notification"
   */
  iconDescription?: string;

  /**
   * Set to `true` to hide the close button
   * @default false
   */
  hideCloseButton?: boolean;

  [key: `data-${string}`]: any;
};

export type ToastNotificationProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ToastNotification extends SvelteComponentTyped<
  ToastNotificationProps,
  {
    close: CustomEvent<{ timeout: boolean }>;
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: Record<string, never> }
> {}
