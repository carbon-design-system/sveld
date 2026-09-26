import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type SlotEventTemplatePropReferenceProps<Icon = any> = {
  /**
   * @default undefined
   */
  icon?: Icon;
};

export type SlotEventTemplatePropReferenceExports = Record<string, never>;

type $Events<Icon = any> = {
  /** `@template` shared by `@event` and `@slot` still becomes a component generic when a prop uses it. */
  select: CustomEvent<Icon>;
};

interface SlotEventTemplatePropReferenceComponent {
  new <Icon = any>(
    options: ComponentConstructorOptions<SlotEventTemplatePropReferenceProps<Icon>>
  ): SvelteComponent<SlotEventTemplatePropReferenceProps<Icon>, $Events<Icon>> & SlotEventTemplatePropReferenceExports;
  <Icon = any>(
    this: void,
    internals: ComponentInternals,
    props: SlotEventTemplatePropReferenceProps<Icon>
  ): {
    $on?<K extends keyof $Events<Icon> & string>(type: K, callback: (e: $Events<Icon>[K]) => void): () => void;
    $set?(props: Partial<SlotEventTemplatePropReferenceProps<Icon>>): void;
  } & SlotEventTemplatePropReferenceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const SlotEventTemplatePropReference: SlotEventTemplatePropReferenceComponent;
export default SlotEventTemplatePropReference;
