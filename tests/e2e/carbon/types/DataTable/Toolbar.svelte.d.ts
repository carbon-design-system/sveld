import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type ToolbarContext = {
  overflowVisible: any;
  setOverflowVisible: (visible: any) => any;
};

type $RestProps = SvelteHTMLElements["section"];

type $Props = {
  /**
   * Specify the toolbar size
   * @default "default"
   */
  size?: "sm" | "default";

  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type ToolbarProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Toolbar extends SvelteComponentTyped<
  ToolbarProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
