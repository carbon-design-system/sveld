import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["svg"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type SvgPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SvgProps extends SvelteComponentTyped<SvgPropsProps, Record<string, any>, {}> {}
