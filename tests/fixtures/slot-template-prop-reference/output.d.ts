import { SvelteComponentTyped } from "svelte";

export type SlotTemplatePropReferenceProps<Icon = any> = {
  /**
   * Specify the icon to render.
   * @default undefined
   */
  icon?: Icon;
};

export default class SlotTemplatePropReference<Icon = any> extends SvelteComponentTyped<
  SlotTemplatePropReferenceProps<Icon>,
  Record<string, any>,
  {
    /**
     * `@template` co-located with `@slot` still sets a component generic when a prop
     * references it, so the emitted `.d.ts` doesn't name an undeclared type.
     */
    icon: Record<string, never>;
  }
> {}
