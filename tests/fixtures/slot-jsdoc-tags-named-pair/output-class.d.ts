import { SvelteComponentTyped } from "svelte";

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

export default class SlotJsdocTagsNamedPair extends SvelteComponentTyped<
  SlotJsdocTagsNamedPairProps,
  Record<string, any>,
  {
    /**
     * Toolbar: icon-only mode uses low-contrast - same as hover-state.
     * @example
     *  ```svelte
     *  <Toolbar><Icon /></Toolbar>
     *  ```
     */
    actions: { compact: boolean };
    /**
     * Status text for live regions; prefer `aria-current="page"` on the active link.
     * @deprecated Use the `live` region pattern instead.
     */
    status: { message: string };
  }
> {}
