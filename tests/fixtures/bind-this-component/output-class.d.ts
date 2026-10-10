import { SvelteComponentTyped } from "svelte";
import type { default as Modal } from "./Modal.svelte";
import type { default as Tooltip } from "./Tooltip.svelte";

export type BindThisComponentProps = {
  /**
   * @default null
   */
  modalRef?: null | (typeof Modal extends abstract new (...args: any) => infer I ? I : typeof Modal extends (...args: any) => infer R ? R : never);

  /**
   * @default null
   */
  tooltipRef?: null | (typeof Tooltip extends abstract new (...args: any) => infer I ? I : typeof Tooltip extends (...args: any) => infer R ? R : never);
};

export default class BindThisComponent extends SvelteComponentTyped<
  BindThisComponentProps,
  Record<string, any>,
  Record<string, never>
> {}
