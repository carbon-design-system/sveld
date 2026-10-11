import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type SvelteElementLiteralTagProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SvelteElementLiteralTag extends SvelteComponentTyped<
  SvelteElementLiteralTagProps,
  Record<string, any>,
  Record<string, never>
> {}
