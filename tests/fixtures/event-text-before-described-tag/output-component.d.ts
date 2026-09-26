import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

/**
 * An item id.
 */
export type Item = string;

export type EventTextBeforeDescribedTagProps = {
  /**
   * @default []
   */
  items?: Item[];

  /** Renders one item. */
  item?: (this: void) => void;
};

export type EventTextBeforeDescribedTagExports = Record<string, never>;

type $Events = {
  /** Fired when the selection is cleared. */
  clear: CustomEvent<null>;
  /** Fired when the menu closes. */
  close: CustomEvent<null>;
  /** Fired when the menu opens. */
  open: CustomEvent<null>;
  /** Fired when an item is selected. */
  select: CustomEvent<null>;
};

interface EventTextBeforeDescribedTagComponent {
  new (
    options: ComponentConstructorOptions<EventTextBeforeDescribedTagProps>
  ): SvelteComponent<EventTextBeforeDescribedTagProps, $Events> & EventTextBeforeDescribedTagExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventTextBeforeDescribedTagProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventTextBeforeDescribedTagProps>): void;
  } & EventTextBeforeDescribedTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventTextBeforeDescribedTag: EventTextBeforeDescribedTagComponent;
export default EventTextBeforeDescribedTag;
