import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["svg"];

export type SvgPropsProps = RestProps & {
  [key: `data-${string}`]: any;
};

export default class SvgProps extends SvelteComponentTyped<SvgPropsProps, Record<string, any>, {}> {}
