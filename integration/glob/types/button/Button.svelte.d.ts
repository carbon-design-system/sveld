/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export type tree = boolean;

export type computeTreeLeafDepth = () => any;

/**
 * Finds the nearest parent tree node
 */
export type findParentTreeNode = (node: HTMLElement) => null | HTMLElement;

export interface ButtonProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
  /**
   * @default "button2"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;
}

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
