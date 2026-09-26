import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsProps = {
  children?: (this: void) => void;
};

export type DispatchedEventsExports = Record<string, never>;

type $Events = {
  destroy: CustomEvent<null>;
  "destroy--component": CustomEvent<null>;
  "destroy:component": CustomEvent<null>;
  hover: CustomEvent<{ h1: boolean }>;
};

interface DispatchedEventsComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsProps>
  ): SvelteComponent<DispatchedEventsProps, $Events> & DispatchedEventsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsProps>): void;
  } & DispatchedEventsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEvents: DispatchedEventsComponent;
export default DispatchedEvents;
