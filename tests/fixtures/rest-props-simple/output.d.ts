import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["h1"];

export interface RestPropsSimpleProps extends RestProps {
  [key: `data-${string}`]: any;
}

export default class RestPropsSimple extends SvelteComponentTyped<RestPropsSimpleProps, Record<string, any>, {}> {}
