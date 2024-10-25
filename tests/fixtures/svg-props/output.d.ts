import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["svg"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type SvgPropsProps = Omit<RestProps, keyof $ComponentProps> & $ComponentProps;

export default class SvgProps extends SvelteComponentTyped<SvgPropsProps, Record<string, any>, {}> {}
