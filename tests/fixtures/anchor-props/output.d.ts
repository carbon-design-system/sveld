import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["a"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type AnchorPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class AnchorProps extends SvelteComponentTyped<
  AnchorPropsProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
