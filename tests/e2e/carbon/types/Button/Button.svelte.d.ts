import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

import type { ButtonSkeletonProps } from "./ButtonSkeleton.svelte";

type $RestProps = SvelteHTMLElements["button"] &
  SvelteHTMLElements["a"] &
  SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the kind of button
   * @default "primary"
   */
  kind?:
    | "primary"
    | "secondary"
    | "tertiary"
    | "ghost"
    | "danger"
    | "danger-tertiary"
    | "danger-ghost";

  /**
   * Specify the size of button
   * @default "default"
   */
  size?: "default" | "field" | "small";

  /**
   * Set to `true` for the icon-only variant
   * @deprecated inferred using the $$slots API
   * @default false
   */
  hasIconOnly?: boolean;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Specify the ARIA label for the button icon
   * @default undefined
   */
  iconDescription?: string;

  /**
   * Set the alignment of the tooltip relative to the icon
   * `hasIconOnly` must be set to `true`
   * @default "center"
   */
  tooltipAlignment?: "start" | "center" | "end";

  /**
   * Set the position of the tooltip relative to the icon
   * @default "bottom"
   */
  tooltipPosition?: "top" | "right" | "bottom" | "left";

  /**
   * Set to `true` to render a custom HTML element
   * Props are destructured as `props` in the default slot (e.g., <Button let:props><div {...props}>...</div></Button>)
   * @default false
   */
  as?: boolean;

  /**
   * Set to `true` to display the skeleton state
   * @default false
   */
  skeleton?: boolean;

  /**
   * Set to `true` to disable the button
   * @default false
   */
  disabled?: boolean;

  /**
   * Set the `href` to use an anchor link
   * @default undefined
   */
  href?: string;

  /**
   * Specify the tabindex
   * @default "0"
   */
  tabindex?: string;

  /**
   * Specify the `type` attribute for the button element
   * @default "button"
   */
  type?: string;

  /**
   * Obtain a reference to the HTML element
   * @default null
   */
  ref?: null | HTMLAnchorElement | HTMLButtonElement;

  [key: `data-${string}`]: any;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {
    default: {
      props: {
        role: "button";
        type?: string;
        tabindex: any;
        disabled: boolean;
        href?: string;
        class: string;
        [key: string]: any;
      };
    };
  }
> {}
