import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type SvelteElementHardcodedDivProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SvelteElementHardcodedDiv extends SvelteComponentTyped<
  SvelteElementHardcodedDivProps,
  Record<string, any>,
  Record<string, never>
> {}
