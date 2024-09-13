import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type tree = boolean;

export declare function computeTreeLeafDepth(): any;

/**
 * Finds the nearest parent tree node
 */
export declare function findParentTreeNode(
  node: HTMLElement
): null | HTMLElement;

type RestProps = SvelteHTMLElements["button"];

export interface ButtonProps extends RestProps {
  /**
   * @default "button"
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
