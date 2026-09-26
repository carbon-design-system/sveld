import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type EventsStableOrderProps = Record<string, never>;

export type EventsStableOrderExports = Record<string, never>;

type $Events = {
  alpha: CustomEvent<null>;
  blur: WindowEventMap["blur"];
  click: WindowEventMap["click"];
  zeta: CustomEvent<null>;
};

interface EventsStableOrderComponent {
  new (
    options: ComponentConstructorOptions<EventsStableOrderProps>
  ): SvelteComponent<EventsStableOrderProps, $Events> & EventsStableOrderExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventsStableOrderProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventsStableOrderProps>): void;
  } & EventsStableOrderExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventsStableOrder: EventsStableOrderComponent;
export default EventsStableOrder;
