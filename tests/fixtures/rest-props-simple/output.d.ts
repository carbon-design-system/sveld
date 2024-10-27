import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["h1"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type RestPropsSimpleProps = Omit<RestProps, keyof $Props> & $Props;

export default class RestPropsSimple extends SvelteComponentTyped<RestPropsSimpleProps, Record<string, any>, {}> {}
