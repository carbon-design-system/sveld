import type { Component } from "svelte";
import type { Base, Meta } from "./base.js";

interface Item extends Base, Pick<Meta, "tag"> {
  label: string;
}

export type InterfaceExtendsImportedProps = {
  item: Item;
};

export type InterfaceExtendsImportedExports = Record<string, never>;

declare const InterfaceExtendsImported: Component<
  InterfaceExtendsImportedProps,
  InterfaceExtendsImportedExports,
  ""
>;
export default InterfaceExtendsImported;
