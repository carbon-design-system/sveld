import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["h1"];

export interface RestPropsProps extends RestProps {
  [key: `data-${string}`]: any;
}

export default class RestProps extends SvelteComponentTyped<RestPropsProps, Record<string, any>, {}> {}
