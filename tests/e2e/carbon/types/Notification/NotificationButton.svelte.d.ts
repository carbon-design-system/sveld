import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["button"];

type $ComponentProps = {
  /**
   * Set the type of notification
   * @default "toast"
   */
  notificationType?: "toast" | "inline";

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Specify the title of the icon
   * @default undefined
   */
  title?: string;

  /**
   * Specify the ARIA label for the icon
   * @default "Close icon"
   */
  iconDescription?: string;

  [key: `data-${string}`]: any;
};

export type NotificationButtonProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class NotificationButton extends SvelteComponentTyped<
  NotificationButtonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
