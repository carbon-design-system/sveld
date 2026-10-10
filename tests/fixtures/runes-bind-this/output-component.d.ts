import type { Component } from "svelte";
import type { default as Modal } from "./Modal.svelte";

export type RunesBindThisProps = {
  /**
   * @default null
   */
  svgRef?: null | SVGSVGElement;

  /**
   * @default null
   */
  pathRef?: null | SVGPathElement;

  /**
   * @default null
   */
  modalRef?: null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never);
};

export type RunesBindThisExports = Record<string, never>;

declare const RunesBindThis: Component<
  RunesBindThisProps,
  RunesBindThisExports,
  "svgRef" | "pathRef" | "modalRef"
>;
export default RunesBindThis;
