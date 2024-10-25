import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

export type LinkProps = RestProps & {
  [key: `data-${string}`]: any;
};

export default class Link extends SvelteComponentTyped<
  LinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
