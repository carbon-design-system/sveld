import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { ButtonProps } from "./Button.svelte";

export type SlotExtendsTemplateProps<Icon = any> = ButtonProps & {
  /**
   * @default undefined
   */
  icon?: Icon;

  /** Optional badge overlay. */
  badge?: (this: void) => void;
};

export type SlotExtendsTemplateExports = Record<string, never>;

interface SlotExtendsTemplateComponent {
  new <Icon = any>(
    options: ComponentConstructorOptions<SlotExtendsTemplateProps<Icon>>
  ): SvelteComponent<SlotExtendsTemplateProps<Icon>> & SlotExtendsTemplateExports;
  <Icon = any>(
    this: void,
    internals: ComponentInternals,
    props: SlotExtendsTemplateProps<Icon>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<SlotExtendsTemplateProps<Icon>>): void;
  } & SlotExtendsTemplateExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const SlotExtendsTemplate: SlotExtendsTemplateComponent;
export default SlotExtendsTemplate;
