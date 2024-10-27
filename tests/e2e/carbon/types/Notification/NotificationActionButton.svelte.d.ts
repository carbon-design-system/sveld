import type { SvelteComponentTyped } from "svelte";

export type NotificationActionButtonProps = {};

export default class NotificationActionButton extends SvelteComponentTyped<
  NotificationActionButtonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
