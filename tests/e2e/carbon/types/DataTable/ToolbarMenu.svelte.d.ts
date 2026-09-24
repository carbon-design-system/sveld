import { SvelteComponentTyped } from "svelte";
import type { OverflowMenuProps } from "../OverflowMenu/OverflowMenu.svelte";

type $Props = {
  children?: (this: void) => void;
};

export type ToolbarMenuProps = Omit<OverflowMenuProps, keyof $Props> & $Props;

export default class ToolbarMenu extends SvelteComponentTyped<
  ToolbarMenuProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
