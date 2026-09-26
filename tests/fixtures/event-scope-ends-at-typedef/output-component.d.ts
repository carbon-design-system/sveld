import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

/**
 * Options desc
 * continued unindented.
 */
export type Options = {
  /** Label desc. */
  label: string;
};

export type EventScopeEndsAtTypedefProps = {
  /**
   * Options desc
   * continued unindented.
   * @default { label: "" }
   */
  options?: Options;

  /**
   * Footer desc
   * continued footer.
   */
  footer?: (this: void) => void;
};

export type EventScopeEndsAtTypedefExports = Record<string, never>;

type $Events = {
  /** Go desc. */
  go: CustomEvent<null>;
};

interface EventScopeEndsAtTypedefComponent {
  new (
    options: ComponentConstructorOptions<EventScopeEndsAtTypedefProps>
  ): SvelteComponent<EventScopeEndsAtTypedefProps, $Events> & EventScopeEndsAtTypedefExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventScopeEndsAtTypedefProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventScopeEndsAtTypedefProps>): void;
  } & EventScopeEndsAtTypedefExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventScopeEndsAtTypedef: EventScopeEndsAtTypedefComponent;
export default EventScopeEndsAtTypedef;
