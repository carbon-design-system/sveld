import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["a"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type LinkProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Link extends SvelteComponentTyped<
  LinkProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
