import type { Component } from "svelte";

export type SlotJsdocNonPassthroughTagsProps = {
  /** Body slot uses a generic from `@template`; that tag must not appear on the slot in output. */
  body?: (this: void, ...args: [{ n: number }]) => void;

  /** `@enum` shares blocks with typedefs/slots in some codebases; it must not attach to the slot. */
  item?: (this: void, ...args: [{ id: string }]) => void;

  /** `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag. */
  row?: (this: void, ...args: [{ flag: boolean }]) => void;
};

export type SlotJsdocNonPassthroughTagsExports = Record<string, never>;

declare const SlotJsdocNonPassthroughTags: Component<
  SlotJsdocNonPassthroughTagsProps,
  SlotJsdocNonPassthroughTagsExports,
  ""
>;
export default SlotJsdocNonPassthroughTags;
