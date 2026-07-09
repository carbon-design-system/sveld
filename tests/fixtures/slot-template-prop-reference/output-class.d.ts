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
     * `@template` in a `@slot` block becomes a component generic when a prop uses the name.
     * Without that, `.d.ts` references an undeclared type (TS2304).
     */
    icon: Record<string, never>;
  }
> {}
