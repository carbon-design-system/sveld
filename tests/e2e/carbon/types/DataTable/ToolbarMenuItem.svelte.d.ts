import { SvelteComponentTyped } from "svelte";
import type { OverflowMenuItemProps } from "../OverflowMenu/OverflowMenuItem.svelte";

type $Props = {
  children?: (this: void) => void;
};

export type ToolbarMenuItemProps = Omit<OverflowMenuItemProps, keyof $Props> & $Props;

export default class ToolbarMenuItem extends SvelteComponentTyped<
  ToolbarMenuItemProps,
  {
    click: WindowEventMap["click"];
    keydown: WindowEventMap["keydown"];
  },
  { default: Record<string, never> }
> {}
