import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type SlotEventTemplatePropReferenceProps<Icon = any> = {
  /**
   * @default undefined
   */
  icon?: Icon;

  /** `@template` shared by `@event` and `@slot` still becomes a component generic when a prop uses it. */
  onselect?: (event: CustomEvent<Icon>) => void;
};

export type SlotEventTemplatePropReferenceExports = Record<string, never>;

interface SlotEventTemplatePropReferenceComponent {
  new <Icon = any>(
    options: ComponentConstructorOptions<SlotEventTemplatePropReferenceProps<Icon>>
  ): SvelteComponent<SlotEventTemplatePropReferenceProps<Icon>> & SlotEventTemplatePropReferenceExports;
  <Icon = any>(
    this: void,
    internals: ComponentInternals,
    props: SlotEventTemplatePropReferenceProps<Icon>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<SlotEventTemplatePropReferenceProps<Icon>>): void;
  } & SlotEventTemplatePropReferenceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const SlotEventTemplatePropReference: SlotEventTemplatePropReferenceComponent;
export default SlotEventTemplatePropReference;
