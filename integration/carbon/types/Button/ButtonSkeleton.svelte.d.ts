/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface ButtonSkeletonProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /**
   * Set the `href` to use an anchor link
   * @default undefined
   */
  href?: string;

  /**
   * Specify the size of button skeleton
   * @default "default"
   */
  size?: "default" | "field" | "small";

  /**
   * @deprecated this prop will be removed in the next major release
   * Use size="small" instead
   * @default false
   */
  small?: boolean;
}

export default class ButtonSkeleton extends SvelteComponentTyped<
  ButtonSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
