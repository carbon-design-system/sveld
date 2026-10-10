import { SvelteComponentTyped } from "svelte";

export type BindThisMathmlProps = {
  /**
   * @default null
   */
  mathRef?: null | MathMLElement;

  /**
   * @default null
   */
  fractionRef?: null | MathMLElement;

  /**
   * @default null
   */
  textRef?: null | MathMLElement;

  /**
   * @default null
   */
  spanRef?: null | HTMLSpanElement;
};

export default class BindThisMathml extends SvelteComponentTyped<
  BindThisMathmlProps,
  Record<string, any>,
  Record<string, never>
> {}
