import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DemoWrapperContext<Value extends string = string, Icon = any> = {
  selectedValue: import("svelte/store").Writable<Value | undefined>;
  icon: Icon;
};

export type ContextTemplateTagMultipleProps<Value extends string = string, Icon = any> = {
  /**
   * @default undefined
   */
  selected?: Value | undefined;

  /**
   * @default undefined
   */
  icon?: Icon;

  children?: (this: void) => void;
};

export type ContextTemplateTagMultipleExports = Record<string, never>;

interface ContextTemplateTagMultipleComponent {
  new <Value extends string = string, Icon = any>(
    options: ComponentConstructorOptions<ContextTemplateTagMultipleProps<Value, Icon>>
  ): SvelteComponent<ContextTemplateTagMultipleProps<Value, Icon>> & ContextTemplateTagMultipleExports;
  <Value extends string = string, Icon = any>(
    this: void,
    internals: ComponentInternals,
    props: ContextTemplateTagMultipleProps<Value, Icon>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ContextTemplateTagMultipleProps<Value, Icon>>): void;
  } & ContextTemplateTagMultipleExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ContextTemplateTagMultiple: ContextTemplateTagMultipleComponent;
export default ContextTemplateTagMultiple;
