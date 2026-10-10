import { SvelteComponentTyped } from "svelte";
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

export default class BindThisEach extends SvelteComponentTyped<
  BindThisEachProps,
  Record<string, any>,
  Record<string, never>
> {}
