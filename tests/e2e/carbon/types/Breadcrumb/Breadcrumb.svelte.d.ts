import { SvelteComponentTyped } from "svelte";
import type { BreadcrumbSkeletonProps } from "./BreadcrumbSkeleton.svelte";

export type BreadcrumbProps = BreadcrumbSkeletonProps & {
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
};

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
