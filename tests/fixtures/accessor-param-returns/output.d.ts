import { SvelteComponentTyped } from "svelte";

export type NotificationData = {
  /** Optional id for deduplication */ id?: string;
  kind?: "error" | "info" | "success";
  title?: string;
};

export type AccessorParamReturnsProps = Record<string, never>;

export default class AccessorParamReturns extends SvelteComponentTyped<
  AccessorParamReturnsProps,
  Record<string, any>,
  Record<string, never>
> {
  /**
   * Add a notification to the queue.
   * If a notification with the same id exists, the call is ignored.
   */
  add: (notification: NotificationData) => string;

  /**
   * Remove a notification by id.
   */
  remove: (id: string) => boolean;

  /**
   * Clear all notifications.
   */
  clear: () => void;

  /**
   * Get notification count.
   */
  getCount: () => number;

  /**
   * Update a notification.
   */
  update: (id: string, data: NotificationData) => boolean;

  /**
   * Function with only @param, no @returns (should default to any)
   */
  log: (message: string) => any;

  /**
   * Computes the depth of a tree leaf node relative to <ul role="tree" />
   * @example
   * ```js
   * let nodeElement;
   * $: depth = computeTreeLeafDepth(nodeElement);
   * ```
   */
  computeTreeLeafDepth: (node: HTMLLIElement) => number;
}
