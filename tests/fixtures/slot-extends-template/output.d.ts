import { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "./Button.svelte";

export type SlotExtendsTemplateProps<Icon = any> = ButtonProps & {
  /**
   * @default undefined
   */
  icon?: Icon;

  /** Optional badge overlay. */
  badge?: (this: void) => void;
};

export default class SlotExtendsTemplate<Icon = any> extends SvelteComponentTyped<
  SlotExtendsTemplateProps<Icon>,
  Record<string, any>,
  {
    /** Optional badge overlay. */
    badge: Record<string, never>;
  }
> {}
