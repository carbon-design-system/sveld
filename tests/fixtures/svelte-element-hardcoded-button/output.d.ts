import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type SvelteElementHardcodedButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SvelteElementHardcodedButton extends SvelteComponentTyped<
  SvelteElementHardcodedButtonProps,
  Record<string, any>,
  Record<string, never>
> {}
