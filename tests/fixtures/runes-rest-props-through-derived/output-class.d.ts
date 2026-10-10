import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "md"
   */
  size?: "sm" | "md";

  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsThroughDerivedProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RunesRestPropsThroughDerived extends SvelteComponentTyped<
  RunesRestPropsThroughDerivedProps,
  Record<string, any>,
  Record<string, never>
> {}
