import type { Component } from "svelte";
import type { default as Modal } from "./Modal.svelte";
import type { default as Tooltip } from "./Tooltip.svelte";
import type { Popover } from "./ui.js";

export type BindThisComponentProps = {
  /**
   * @default null
   */
  modalRef?: null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never);

  /**
   * @default null
   */
  tooltipRef?: null | (typeof Tooltip extends abstract new (...args: any) => infer I ? I : typeof Tooltip extends (...args: any) => infer R ? R : never);

  /**
   * @default null
   */
  popoverRef?: null | (typeof Popover extends abstract new (...args: any) => infer I ? I : typeof Popover extends (...args: any) => infer R ? R : never);

  /**
   * @default null
   */
  elementOrModal?: null | HTMLDivElement | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never);

  /**
   * @default null
   */
  namespacedRef?: any;

  /**
   * @default null
   */
  selfRef?: any;
};

export type BindThisComponentExports = Record<string, never>;

declare const BindThisComponent: Component<
  BindThisComponentProps,
  BindThisComponentExports,
  ""
>;
export default BindThisComponent;
