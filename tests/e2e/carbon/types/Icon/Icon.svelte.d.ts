import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

import type { IconSkeletonProps } from "./IconSkeleton.svelte";

type RestProps = SvelteHTMLElements["svg"];

export interface IconProps extends IconSkeletonProps, RestProps {
  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  render?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Set to `true` to display the skeleton state
   * @default false
   */
  skeleton?: boolean;

  [key: `data-${string}`]: any;
}

export default class Icon extends SvelteComponentTyped<
  IconProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
