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
    /** `@template` shared by `@event` and `@slot` still becomes a component generic when a prop uses it. */
    select: CustomEvent<Icon>;
  },
  { icon: Record<string, never> }
> {}
