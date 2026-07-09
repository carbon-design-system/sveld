import type { Component } from "svelte";

export type SlotJsdocTemplateNotPassthroughProps = {
  /** Body slot uses a generic from `@template`; that tag must not appear on the slot in output. */
  body?: (this: void, ...args: [{ n: number }]) => void;
};

export type SlotJsdocTemplateNotPassthroughExports = Record<string, never>;

declare const SlotJsdocTemplateNotPassthrough: Component<
  SlotJsdocTemplateNotPassthroughProps,
  SlotJsdocTemplateNotPassthroughExports,
  ""
>;
export default SlotJsdocTemplateNotPassthrough;
