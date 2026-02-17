import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

/**
 * Rest props are spread to the span (inline variant)
 * or the copy button (single/multi).
 */
type $RestProps = SvelteHTMLElements["button"] & SvelteHTMLElements["span"];

type $Props = {
  /**
   * @default "single"
   */
  variant?: "inline" | "single" | "multi";

  [key: `data-${string}`]: unknown;
};

export type RestPropsDescriptionMultilineProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RestPropsDescriptionMultiline extends SvelteComponentTyped<
  RestPropsDescriptionMultilineProps,
  Record<string, any>,
  Record<string, never>
> {}
