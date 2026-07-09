import type { Component } from "svelte";

export type SlotJsdocTagsNamedPairProps = {
  /**
   * Toolbar: icon-only mode uses low-contrast - same as hover-state.
   * @example
   *  ```svelte
   *  <Toolbar><Icon /></Toolbar>
   *  ```
   */
  actions?: (this: void, ...args: [{ compact: boolean }]) => void;

  /**
   * Status text for live regions; prefer `aria-current="page"` on the active link.
   * @deprecated Use the `live` region pattern instead.
   */
  status?: (this: void, ...args: [{ message: string }]) => void;
};

export type SlotJsdocTagsNamedPairExports = Record<string, never>;

declare const SlotJsdocTagsNamedPair: Component<
  SlotJsdocTagsNamedPairProps,
  SlotJsdocTagsNamedPairExports,
  ""
>;
export default SlotJsdocTagsNamedPair;
