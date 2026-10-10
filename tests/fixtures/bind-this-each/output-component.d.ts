import type { Component } from "svelte";
import type { default as Modal } from "./Modal.svelte";

export type BindThisEachProps = {
  /**
   * @default ["a", "b"]
   */
  items?: string[];

  /**
   * @default []
   */
  itemRefs?: (null | HTMLLIElement)[];

  /**
   * @default []
   */
  keyedRefs?: (null | HTMLSpanElement)[];

  /**
   * @default []
   */
  circleRefs?: (null | SVGCircleElement)[];

  /**
   * @default []
   */
  modalRefs?: (null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never))[];
};

export type BindThisEachExports = Record<string, never>;

declare const BindThisEach: Component<
  BindThisEachProps,
  BindThisEachExports,
  ""
>;
export default BindThisEach;
