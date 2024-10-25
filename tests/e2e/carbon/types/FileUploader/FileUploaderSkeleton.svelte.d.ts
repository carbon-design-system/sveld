import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type FileUploaderSkeletonProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class FileUploaderSkeleton extends SvelteComponentTyped<
  FileUploaderSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
