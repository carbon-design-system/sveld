import { SvelteComponentTyped } from "svelte";

export type RunesPropDefaultIdentifierJsdocProps = {
  /**
   * Override the default copy behavior of using the navigator.clipboard.writeText API to copy text.
   */
  copy?: (text: string) => void | Promise<void>;

  /**
   * Default size in pixels.
   * @default 16
   */
  size?: number;

  /**
   * Animation configuration applied on mount.
   * @default { duration: 200, easing: "ease-in-out" }
   */
  config?: {
    duration: number;
    easing: string
  };

  /**
   * Fallback label shown when none is provided.
   * @default "Submit"
   */
  label?: string;

  /**
   * Determine if an item should be filtered given the current value.
   */
  shouldFilterItem?: (item: string, value: string) => boolean;

  format?: (value: any) => string;

  /**
   * Render the message shown when there are no items.
   */
  renderEmpty?: (...args: any[]) => string;

  /**
   * Resolve the unique key for an item.
   */
  getKey?: (item: string, index: number) => string;

  /**
   * Translate a label to the active locale.
   */
  translate?: (key: string) => string;
};

export default class RunesPropDefaultIdentifierJsdoc extends SvelteComponentTyped<
  RunesPropDefaultIdentifierJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
