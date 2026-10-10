import type { Component } from "svelte";
import type { default as Modal } from "./Modal.svelte";

export type RunesBindThisEachProps = {
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
  circleRefs?: (null | SVGCircleElement)[];

  /**
   * @default []
   */
  modalRefs?: (null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never))[];
};

export type RunesBindThisEachExports = Record<string, never>;

declare const RunesBindThisEach: Component<
  RunesBindThisEachProps,
  RunesBindThisEachExports,
  "itemRefs" | "circleRefs" | "modalRefs"
>;
export default RunesBindThisEach;
