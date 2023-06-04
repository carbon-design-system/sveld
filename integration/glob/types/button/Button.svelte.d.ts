/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export type tree = boolean;

export declare function computeTreeLeafDepth(): any;

/**
 * Finds the nearest parent tree node
 */
export declare function findParentTreeNode(
  node: HTMLElement
): null | HTMLElement;

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

  [key: `data-${string}`]: any;
}

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
