import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["h1"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type RestPropsSimpleProps = Omit<RestProps, keyof $ComponentProps> & $ComponentProps;

export default class RestPropsSimple extends SvelteComponentTyped<RestPropsSimpleProps, Record<string, any>, {}> {}
