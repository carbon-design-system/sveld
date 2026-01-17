import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type TabsContext = {
  tabs: any;
  contentById: any;
  selectedTab: any;
  selectedContent: any;
  add: (data: any) => any;
  addContent: (data: any) => any;
  update: (id: any) => any;
  change: (direction: any) => any;
};

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
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

  content?: () => void;

  [key: `data-${string}`]: any;
};

export type TabsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Tabs extends SvelteComponentTyped<
  TabsProps,
  {
    keypress: WindowEventMap["keypress"];
    click: WindowEventMap["click"];
    change: CustomEvent<any>;
  },
  { default: Record<string, never>; content: Record<string, never> }
> {}
