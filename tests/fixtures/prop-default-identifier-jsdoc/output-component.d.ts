import type { Component } from "svelte";

export type PropDefaultIdentifierJsdocProps = {
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
   * Items rendered when no value is provided.
   * @default ["one", "two"]
   */
  items?: string[];

  /**
   * Fallback label shown when none is provided.
   * @default "Submit"
   */
  label?: string;

  /**
   * Determine if an item should be filtered given the current combobox value.
   * When `typeahead` is enabled and no custom function is provided,
   * the default case-insensitive prefix matching is used.
   * When a custom function is provided, it is used even with `typeahead`.
   * @default () => true
   */
  shouldFilterItem?: (item: string, value: string) => boolean;

  /**
   * @default (value) => String(value)
   */
  format?: (value: any) => string;

  /**
   * Render the message shown when there are no items.
   * @default () => "No results"
   */
  renderEmpty?: (...args: any[]) => string;

  /**
   * Resolve the unique key for an item.
   * @default () => ""
   */
  getKey?: (item: string, index: number) => string;

  /**
   * Translate a label to the active locale.
   * @default (key) => key
   */
  translate?: (key: string) => string;
};

export type PropDefaultIdentifierJsdocExports = Record<string, never>;

declare const PropDefaultIdentifierJsdoc: Component<
  PropDefaultIdentifierJsdocProps,
  PropDefaultIdentifierJsdocExports,
  ""
>;
export default PropDefaultIdentifierJsdoc;
