import { SvelteComponentTyped } from "svelte";

export type SlotEventTemplatePropReferenceProps<Icon = any> = {
  /**
   * @default undefined
   */
  icon?: Icon;
};

export default class SlotEventTemplatePropReference<Icon = any> extends SvelteComponentTyped<
  SlotEventTemplatePropReferenceProps<Icon>,
  {
    /**
     * `@template` shared with both `@event` and `@slot` still sets a component generic
     * when a prop references it.
     */
    select: CustomEvent<Icon>;
  },
  { icon: Record<string, never> }
> {}
