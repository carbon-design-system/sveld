import type { SvelteComponentTyped } from "svelte";

export type NotificationActionButtonProps = Record<string, never>;

export default class NotificationActionButton extends SvelteComponentTyped<
  NotificationActionButtonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: Record<string, never> }
> {}
