import type { Component } from "svelte";

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

export type BindThisMathmlExports = Record<string, never>;

declare const BindThisMathml: Component<
  BindThisMathmlProps,
  BindThisMathmlExports,
  ""
>;
export default BindThisMathml;
