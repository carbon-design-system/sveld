import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type ContentSwitcherContext = {
  currentId: any;
  add: (arg: any) => any;
  update: (id: any) => any;
  change: (direction: any) => any;
};

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set the selected index of the switch item
   * @default 0
   */
  selectedIndex?: number;

  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  /**
   * Specify the size of the content switcher
   * @default undefined
   */
  size?: "sm" | "xl";

  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type ContentSwitcherProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ContentSwitcher extends SvelteComponentTyped<
  ContentSwitcherProps,
  {
    /** Fired when the `selectedIndex` is updated. */
    change: CustomEvent<number>;
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: Record<string, never> }
> {}
