import type { Component } from "svelte";

export type SlotDescriptionHyphensInlineProps = {
  /** Row id maps to server-side UUID v4 (not v1-v3). */
  item?: (this: void, ...args: [{ id: string }]) => void;
};

export type SlotDescriptionHyphensInlineExports = Record<string, never>;

declare const SlotDescriptionHyphensInline: Component<
  SlotDescriptionHyphensInlineProps,
  SlotDescriptionHyphensInlineExports,
  ""
>;
export default SlotDescriptionHyphensInline;
