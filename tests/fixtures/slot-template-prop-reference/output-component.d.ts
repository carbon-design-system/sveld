import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type SlotTemplatePropReferenceProps<Icon = any> = {
  /**
   * Specify the icon to render.
   * @default undefined
   */
  icon?: Icon;
};

export type SlotTemplatePropReferenceExports = Record<string, never>;

interface SlotTemplatePropReferenceComponent {
  new <Icon = any>(
    options: ComponentConstructorOptions<SlotTemplatePropReferenceProps<Icon>>
  ): SvelteComponent<SlotTemplatePropReferenceProps<Icon>> & SlotTemplatePropReferenceExports;
  <Icon = any>(
    this: void,
    internals: ComponentInternals,
    props: SlotTemplatePropReferenceProps<Icon>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<SlotTemplatePropReferenceProps<Icon>>): void;
  } & SlotTemplatePropReferenceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const SlotTemplatePropReference: SlotTemplatePropReferenceComponent;
export default SlotTemplatePropReference;
