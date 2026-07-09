import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DemoContext<Value$Type extends string> = {
  value: Value$Type;
};

export type ContextGenericsDollarNameProps<Value$Type extends string> = {
  children?: (this: void) => void;
};

export type ContextGenericsDollarNameExports = Record<string, never>;

interface ContextGenericsDollarNameComponent {
  new <Value$Type extends string>(
    options: ComponentConstructorOptions<ContextGenericsDollarNameProps<Value$Type>>
  ): SvelteComponent<ContextGenericsDollarNameProps<Value$Type>> & ContextGenericsDollarNameExports;
  <Value$Type extends string>(
    this: void,
    internals: ComponentInternals,
    props: ContextGenericsDollarNameProps<Value$Type>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ContextGenericsDollarNameProps<Value$Type>>): void;
  } & ContextGenericsDollarNameExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ContextGenericsDollarName: ContextGenericsDollarNameComponent;
export default ContextGenericsDollarName;
