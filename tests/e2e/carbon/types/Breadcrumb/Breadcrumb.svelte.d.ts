import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { BreadcrumbSkeletonProps } from "./BreadcrumbSkeleton.svelte";

type $RestProps = SvelteHTMLElements["nav"];

type $Props = {
  /**
   * Set to `true` to hide the breadcrumb trailing slash
   * @default false
   */
  noTrailingSlash?: boolean;

  /**
   * Set to `true` to display skeleton state
   * @default false
   */
  skeleton?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type BreadcrumbProps = Omit<$RestProps, keyof ($Props & BreadcrumbSkeletonProps)> & Omit<BreadcrumbSkeletonProps, keyof $Props> & $Props;

export default class Breadcrumb extends SvelteComponentTyped<
  BreadcrumbProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
