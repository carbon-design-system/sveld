import type { Component } from "svelte";

export type SlotPlainTextAttributePropProps = {
  children?: (this: void, ...args: [{ color: "red" }]) => void;
};

export type SlotPlainTextAttributePropExports = Record<string, never>;

declare const SlotPlainTextAttributeProp: Component<
  SlotPlainTextAttributePropProps,
  SlotPlainTextAttributePropExports,
  ""
>;
export default SlotPlainTextAttributeProp;
