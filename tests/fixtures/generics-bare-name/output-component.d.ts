import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type GenericsBareNameProps<Item> = {
  value: Item;
};

export type GenericsBareNameExports = Record<string, never>;

interface GenericsBareNameComponent {
  new <Item>(
    options: ComponentConstructorOptions<GenericsBareNameProps<Item>>
  ): SvelteComponent<GenericsBareNameProps<Item>> & GenericsBareNameExports;
  <Item>(
    this: void,
    internals: ComponentInternals,
    props: GenericsBareNameProps<Item>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsBareNameProps<Item>>): void;
  } & GenericsBareNameExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsBareName: GenericsBareNameComponent;
export default GenericsBareName;
