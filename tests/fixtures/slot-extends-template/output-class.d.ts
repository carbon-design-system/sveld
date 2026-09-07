import { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "./Button.svelte";

type $Props<Icon = any> = {
  /**
   * @default undefined
   */
  icon?: Icon;

  /** Optional badge overlay. */
  badge?: (this: void) => void;
};

export type SlotExtendsTemplateProps<Icon = any> = Omit<ButtonProps, keyof $Props<Icon>> & $Props<Icon>;

export default class SlotExtendsTemplate<Icon = any> extends SvelteComponentTyped<
  SlotExtendsTemplateProps<Icon>,
  Record<string, any>,
  {
    /** Optional badge overlay. */
    badge: Record<string, never>;
  }
> {}
