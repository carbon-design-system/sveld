import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type Attributes = {
  /** The element's data id. */
  "data-id": string;
  "aria-hidden": boolean;
};

export type EventDetailQuotedKeysProps = Record<string, never>;

export type EventDetailQuotedKeysExports = Record<string, never>;

type $Events = {
  change: CustomEvent<{
      "a-b": number;
      ok: boolean;
      "3": string;
      "with space": string;
    }>;
  select: CustomEvent<{
      /** The selected item's id. */
      "item-id": string;
      index?: number;
    }>;
};

interface EventDetailQuotedKeysComponent {
  new (
    options: ComponentConstructorOptions<EventDetailQuotedKeysProps>
  ): SvelteComponent<EventDetailQuotedKeysProps, $Events> & EventDetailQuotedKeysExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventDetailQuotedKeysProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventDetailQuotedKeysProps>): void;
  } & EventDetailQuotedKeysExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventDetailQuotedKeys: EventDetailQuotedKeysComponent;
export default EventDetailQuotedKeys;
