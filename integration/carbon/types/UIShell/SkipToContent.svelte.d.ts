/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface SkipToContentProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /**
   * Specify the `href` attribute
   * @default "#main-content"
   */
  href?: string;

  /**
   * Specify the tabindex
   * @default "0"
   */
  tabindex?: string;
  /** @default false */
  "sveltekit:prefetch"?: boolean;

  /** @default false */
  "sveltekit:noscroll"?: boolean;
}

export default class SkipToContent extends SvelteComponentTyped<
  SkipToContentProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
