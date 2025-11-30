import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type OverflowMenuContext = {
  focusedId: any;
  add: (arg: any) => any;
  update: (id: any) => any;
  change: (direction: any) => any;
};

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Specify the size of the overflow menu
   * @default undefined
   */
  size?: "sm" | "xl";

  /**
   * Specify the direction of the overflow menu relative to the button
   * @default "bottom"
   */
  direction?: "top" | "bottom";

  /**
   * Set to `true` to open the menu
   * @default false
   */
  open?: boolean;

  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  /**
   * Set to `true` to flip the menu relative to the button
   * @default false
   */
  flipped?: boolean;

  /**
   * Specify the menu options class
   * @default undefined
   */
  menuOptionsClass?: string;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default OverflowMenuVertical16
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Specify the icon class
   * @default undefined
   */
  iconClass?: string;

  /**
   * Specify the ARIA label for the icon
   * @default "Open and close list of options"
   */
  iconDescription?: string;

  /**
   * Set an id for the button element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Obtain a reference to the trigger button element
   * @default null
   */
  buttonRef?: null | HTMLButtonElement;

  /**
   * Obtain a reference to the overflow menu element
   * @default null
   */
  menuRef?: null | HTMLUListElement;

  [key: `data-${string}`]: any;
};

export type OverflowMenuProps = Omit<$RestProps, keyof $Props> & $Props;

export default class OverflowMenu extends SvelteComponentTyped<
  OverflowMenuProps,
  {
    close: CustomEvent<{ index: number; text: string }>;
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    keydown: WindowEventMap["keydown"];
  },
  { menu: Record<string, never>; default: Record<string, never> }
> {}
