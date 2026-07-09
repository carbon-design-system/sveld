import type { Component } from "svelte";

export type DeprecatedTagsProps = {
  /**
   * The visible label.
   * @deprecated Use the `text` prop instead.
   * @default ""
   */
  label?: string;

  /**
   * @deprecated
   * @default ""
   */
  id?: string;

  /**
   * Badge content rendered next to the label.
   * @deprecated Render the badge inline instead.
   */
  badge?: (this: void, ...args: [{ count: number }]) => void;

  /**
   * Fired when the value changes.
   * @deprecated Listen for the native `input` event instead.
   */
  onchange?: (event: CustomEvent<{ value: string }>) => void;
};

export type DeprecatedTagsExports = {
  /**
   * Programmatically focus the field.
   * @deprecated Focus the underlying element directly.
   */
  focus: () => any;
};

declare const DeprecatedTags: Component<
  DeprecatedTagsProps,
  DeprecatedTagsExports,
  ""
>;
export default DeprecatedTags;
