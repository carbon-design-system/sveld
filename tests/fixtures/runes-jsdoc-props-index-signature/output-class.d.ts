import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "sm"
   */
  size?: "sm" | "md";

  label: string;

  [key: `data-${string}`]: unknown;
};

export type RunesJsdocPropsIndexSignatureProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RunesJsdocPropsIndexSignature extends SvelteComponentTyped<
  RunesJsdocPropsIndexSignatureProps,
  Record<string, any>,
  Record<string, never>
> {}
