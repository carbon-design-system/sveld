import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type Item = {
  /**
   * The item id.
   *
   * Unique within one menu.
   */
  id: string;
};

export type Count = number;

/**
 * The menu's placement.
 *
 * Flips when there's no room.
 */
export type Placement = "top" | "bottom";

export type JsdocContinuationParagraphsProps = {
  /**
   * @default []
   */
  items?: Item[];

  footer?: (this: void) => void;

  /**
   * Renders one item.
   *
   * For example:
   * ```svelte
   * {#if item.id}
   *   <b>{item.id}</b>
   * {/if}
   * ```
   */
  item?: (this: void, ...args: [{ item: Item }]) => void;
};

export type JsdocContinuationParagraphsExports = {
  /**
   * Formats an item.
   */
  format: (item: Item) => string;
};

type $Events = {
  close: CustomEvent<null>;
  /**
   * Fired when the menu opens.
   *
   * Not fired on the first render.
   */
  open: CustomEvent<null>;
};

interface JsdocContinuationParagraphsComponent {
  new (
    options: ComponentConstructorOptions<JsdocContinuationParagraphsProps>
  ): SvelteComponent<JsdocContinuationParagraphsProps, $Events> & JsdocContinuationParagraphsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocContinuationParagraphsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocContinuationParagraphsProps>): void;
  } & JsdocContinuationParagraphsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocContinuationParagraphs: JsdocContinuationParagraphsComponent;
export default JsdocContinuationParagraphs;
