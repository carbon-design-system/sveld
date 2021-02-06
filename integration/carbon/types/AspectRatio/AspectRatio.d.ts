/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface AspectRatioProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["div"]> {
  /**
   * Specify the aspect ratio
   * @default "2x1"
   */
  ratio?: "2x1" | "16x9" | "4x3" | "1x1" | "3x4" | "9x16" | "1x2";
}

export default class AspectRatio extends SvelteComponentTyped<
  AspectRatioProps,
  {},
  { default: {} }
> {}
