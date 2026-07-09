import type { Component } from "svelte";

export type SlotJsdocEnumNotPassthroughProps = {
  /** `@enum` shares blocks with typedefs/slots in some codebases; it must not attach to the slot. */
  item?: (this: void, ...args: [{ id: string }]) => void;
};

export type SlotJsdocEnumNotPassthroughExports = Record<string, never>;

declare const SlotJsdocEnumNotPassthrough: Component<
  SlotJsdocEnumNotPassthroughProps,
  SlotJsdocEnumNotPassthroughExports,
  ""
>;
export default SlotJsdocEnumNotPassthrough;
