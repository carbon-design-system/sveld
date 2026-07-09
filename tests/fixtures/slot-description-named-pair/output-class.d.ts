import { SvelteComponentTyped } from "svelte";

export type SlotDescriptionNamedPairProps = {
  /** Toolbar: icon-only mode uses low-contrast - same as hover-state. */
  actions?: (this: void, ...args: [{ compact: boolean }]) => void;

  /**
   * Status text for live regions; prefer `aria-current="page"` on the active link, not `aria-selected`.
   * Pair with `aria-live="polite"` unless the update is urgent (then use `assertive`).
   */
  status?: (this: void, ...args: [{ message: string }]) => void;
};

export default class SlotDescriptionNamedPair extends SvelteComponentTyped<
  SlotDescriptionNamedPairProps,
  Record<string, any>,
  {
    /** Toolbar: icon-only mode uses low-contrast - same as hover-state. */
    actions: { compact: boolean };
    /**
     * Status text for live regions; prefer `aria-current="page"` on the active link, not `aria-selected`.
     * Pair with `aria-live="polite"` unless the update is urgent (then use `assertive`).
     */
    status: { message: string };
  }
> {}
