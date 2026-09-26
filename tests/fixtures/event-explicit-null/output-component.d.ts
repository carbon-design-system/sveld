import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["input"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type EventExplicitNullProps = Omit<$RestProps, keyof $Props> & $Props;

export type EventExplicitNullExports = Record<string, never>;

type $Events = {
  change: WindowEventMap["change"];
  clear: CustomEvent<null>;
  input: WindowEventMap["input"];
};

interface EventExplicitNullComponent {
  new (
    options: ComponentConstructorOptions<EventExplicitNullProps>
  ): SvelteComponent<EventExplicitNullProps, $Events> & EventExplicitNullExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventExplicitNullProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventExplicitNullProps>): void;
  } & EventExplicitNullExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventExplicitNull: EventExplicitNullComponent;
export default EventExplicitNull;
