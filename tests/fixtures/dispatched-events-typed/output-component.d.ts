import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsTypedProps = {
  children?: (this: void) => void;
};

export type DispatchedEventsTypedExports = Record<string, never>;

type $Events = {
  destroy: CustomEvent<null>;
  /** Fired on mouseover. */
  hover: CustomEvent<{ h1: boolean }>;
};

interface DispatchedEventsTypedComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsTypedProps>
  ): SvelteComponent<DispatchedEventsTypedProps, $Events> & DispatchedEventsTypedExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsTypedProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsTypedProps>): void;
  } & DispatchedEventsTypedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsTyped: DispatchedEventsTypedComponent;
export default DispatchedEventsTyped;
