import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

export type AnchorPropsProps = RestProps & {
  [key: `data-${string}`]: any;
};

export default class AnchorProps extends SvelteComponentTyped<AnchorPropsProps, Record<string, any>, { default: {} }> {}
