/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface LinkProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /** @default false */
  "sveltekit:prefetch"?: boolean;

  /** @default false */
  "sveltekit:noscroll"?: boolean;
}

export default class Link extends SvelteComponentTyped<
  LinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
