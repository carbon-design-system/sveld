import { SvelteComponentTyped } from "svelte";

export type SlotPlainTextAttributePropProps = {
  children?: (this: void, ...args: [{ color: "red" }]) => void;
};

export default class SlotPlainTextAttributeProp extends SvelteComponentTyped<
  SlotPlainTextAttributePropProps,
  Record<string, any>,
  { default: { color: "red" } }
> {}
