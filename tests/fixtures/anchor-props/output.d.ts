import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type AnchorPropsProps = Omit<RestProps, keyof $ComponentProps> & $ComponentProps;

export default class AnchorProps extends SvelteComponentTyped<AnchorPropsProps, Record<string, any>, { default: {} }> {}
