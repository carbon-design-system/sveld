import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export declare const tree: boolean;

export declare function computeTreeLeafDepth(): any;

/**
 * Finds the nearest parent tree node
 */
export declare function findParentTreeNode(
  node: HTMLElement,
): null | HTMLElement;

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "button"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
