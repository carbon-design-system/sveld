import { SvelteComponentTyped } from "svelte";

export type NotificationActionButtonProps = {
  children?: (this: void) => void;
};

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
