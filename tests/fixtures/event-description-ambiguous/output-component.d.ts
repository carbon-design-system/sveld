import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type EventDescriptionAmbiguousProps = Record<string, never>;

export type EventDescriptionAmbiguousExports = Record<string, never>;

type $Events = {
  /** Fired when the menu loses focus. */
  blur: CustomEvent<null>;
  /** Fired when the user selects an item. */
  clear: CustomEvent<null>;
  close: CustomEvent<null>;
  /** Fired when the menu gains focus. */
  focus: CustomEvent<null>;
  /** Fired when the menu opens. */
  open: CustomEvent<{ value: string }>;
  select: CustomEvent<{ value: string }>;
};

interface EventDescriptionAmbiguousComponent {
  new (
    options: ComponentConstructorOptions<EventDescriptionAmbiguousProps>
  ): SvelteComponent<EventDescriptionAmbiguousProps, $Events> & EventDescriptionAmbiguousExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventDescriptionAmbiguousProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventDescriptionAmbiguousProps>): void;
  } & EventDescriptionAmbiguousExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventDescriptionAmbiguous: EventDescriptionAmbiguousComponent;
export default EventDescriptionAmbiguous;
