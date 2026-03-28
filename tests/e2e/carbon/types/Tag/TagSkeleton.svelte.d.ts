import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["span"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type TagSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TagSkeleton extends SvelteComponentTyped<
  TagSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
