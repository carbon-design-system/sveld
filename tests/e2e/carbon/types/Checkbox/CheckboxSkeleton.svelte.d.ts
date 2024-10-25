import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type CheckboxSkeletonProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class CheckboxSkeleton extends SvelteComponentTyped<
  CheckboxSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
