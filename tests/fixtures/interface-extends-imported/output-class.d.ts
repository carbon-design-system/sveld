import { SvelteComponentTyped } from "svelte";
import type { Base, Meta } from "./base.js";

interface Item extends Base, Pick<Meta, "tag"> {
  label: string;
}

export type InterfaceExtendsImportedProps = {
  item: Item;
};

export default class InterfaceExtendsImported extends SvelteComponentTyped<
  InterfaceExtendsImportedProps,
  Record<string, any>,
  Record<string, never>
> {}
