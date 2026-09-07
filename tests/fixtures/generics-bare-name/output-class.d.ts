import { SvelteComponentTyped } from "svelte";

export type GenericsBareNameProps<Item> = {
  value: Item;
};

export default class GenericsBareName<Item> extends SvelteComponentTyped<
  GenericsBareNameProps<Item>,
  Record<string, any>,
  Record<string, never>
> {}
