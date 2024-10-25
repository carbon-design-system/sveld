import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type LinkProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Link extends SvelteComponentTyped<
  LinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
