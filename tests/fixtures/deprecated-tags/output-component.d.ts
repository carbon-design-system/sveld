import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type DeprecatedTagsExports = {
  /**
   * Programmatically focus the field.
   * @deprecated Focus the underlying element directly.
   */
  focus: () => any;
};

type $Events = {
  /**
   * Fired when the value changes.
   * @deprecated Listen for the native `input` event instead.
   */
  change: CustomEvent<{ value: string }>;
};

interface DeprecatedTagsComponent {
  new (
    options: ComponentConstructorOptions<DeprecatedTagsProps>
  ): SvelteComponent<DeprecatedTagsProps, $Events> & DeprecatedTagsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DeprecatedTagsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DeprecatedTagsProps>): void;
  } & DeprecatedTagsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DeprecatedTags: DeprecatedTagsComponent;
export default DeprecatedTags;
