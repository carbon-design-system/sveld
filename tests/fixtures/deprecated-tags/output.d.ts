import { SvelteComponentTyped } from "svelte";

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
};

export default class DeprecatedTags extends SvelteComponentTyped<
  DeprecatedTagsProps,
  {
    /**
     * Fired when the value changes.
     * @deprecated Listen for the native `input` event instead.
     */
    change: CustomEvent<{ value: string }>;
  },
  {
    /**
     * Badge content rendered next to the label.
     * @deprecated Render the badge inline instead.
     */
    badge: { count: number };
  }
> {
  /**
   * Programmatically focus the field.
   * @deprecated Focus the underlying element directly.
   */
  focus: () => any;
}
