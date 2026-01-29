import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

/** Spread to the span (inline variant) or the copy button (single/multi). */
type $RestProps = SvelteHTMLElements["button"] & SvelteHTMLElements["span"];

type $Props = {
  /**
   * @default "single"
   */
  variant?: "inline" | "single" | "multi";

  [key: `data-${string}`]: any;
};

export type RestPropsDescriptionProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RestPropsDescription extends SvelteComponentTyped<
  RestPropsDescriptionProps,
  Record<string, any>,
  Record<string, never>
> {}
