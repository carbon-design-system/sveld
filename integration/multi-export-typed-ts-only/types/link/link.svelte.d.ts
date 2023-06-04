/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface LinkProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  [key: `data-${string}`]: any;
}

export default class Link extends SvelteComponentTyped<
  LinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
