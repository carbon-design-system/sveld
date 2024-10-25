import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Specify the selected tab index
   * @default 0
   */
  selected?: number;

  /**
   * Specify the type of tabs
   * @default "default"
   */
  type?: "default" | "container";

  /**
   * Specify the ARIA label for the chevron icon
   * @default "Show menu options"
   */
  iconDescription?: string;

  /**
   * Specify the tab trigger href attribute
   * @default "#"
   */
  triggerHref?: string;

  [key: `data-${string}`]: any;
};

export type TabsProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Tabs extends SvelteComponentTyped<
  TabsProps,
  {
    keypress: WindowEventMap["keypress"];
    click: WindowEventMap["click"];
    change: CustomEvent<any>;
  },
  { default: {}; content: {} }
> {}
