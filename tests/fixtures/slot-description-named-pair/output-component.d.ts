import type { Component } from "svelte";

export type SlotDescriptionNamedPairProps = {
  /** Toolbar: icon-only mode uses low-contrast - same as hover-state. */
  actions?: (this: void, ...args: [{ compact: boolean }]) => void;

  /**
   * Status text for live regions; prefer `aria-current="page"` on the active link, not `aria-selected`.
   * Pair with `aria-live="polite"` unless the update is urgent (then use `assertive`).
   */
  status?: (this: void, ...args: [{ message: string }]) => void;
};

export type SlotDescriptionNamedPairExports = Record<string, never>;

declare const SlotDescriptionNamedPair: Component<
  SlotDescriptionNamedPairProps,
  SlotDescriptionNamedPairExports,
  ""
>;
export default SlotDescriptionNamedPair;
