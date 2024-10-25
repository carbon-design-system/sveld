import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Specify the aspect ratio
   * @default "2x1"
   */
  ratio?: "2x1" | "16x9" | "4x3" | "1x1" | "3x4" | "9x16" | "1x2";

  [key: `data-${string}`]: any;
};

export type AspectRatioProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class AspectRatio extends SvelteComponentTyped<
  AspectRatioProps,
  Record<string, any>,
  { default: {} }
> {}
