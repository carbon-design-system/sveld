import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Set to `true` to enable the active state
   * @default false
   */
  active?: boolean;

  /**
   * Set to `true` to enable the highlighted state
   * @default false
   */
  highlighted?: boolean;

  [key: `data-${string}`]: any;
};

export type ListBoxMenuItemProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class ListBoxMenuItem extends SvelteComponentTyped<
  ListBoxMenuItemProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
