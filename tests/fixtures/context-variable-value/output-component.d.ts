import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type AbortContext = AbortController;

export type SelectedContext<Item> = Item[];

export type SettingsContext = {
  dense: boolean;
  label?: string;
};

export type ApiContext = {
  reset: () => any;
  version: string;
};

export type StoreContext = any;

export type ContextVariableValueProps<Item> = {
  children?: (this: void) => void;
};

export type ContextVariableValueExports = Record<string, never>;

interface ContextVariableValueComponent {
  new <Item>(
    options: ComponentConstructorOptions<ContextVariableValueProps<Item>>
  ): SvelteComponent<ContextVariableValueProps<Item>> & ContextVariableValueExports;
  <Item>(
    this: void,
    internals: ComponentInternals,
    props: ContextVariableValueProps<Item>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ContextVariableValueProps<Item>>): void;
  } & ContextVariableValueExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ContextVariableValue: ContextVariableValueComponent;
export default ContextVariableValue;
