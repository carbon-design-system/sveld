import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocProps = Record<string, never>;

export type DispatchedEventsTypedDispatcherJsdocExports = Record<string, never>;

type $Events = {
  cancel: CustomEvent<null>;
  save: CustomEvent<{ id: string }>;
};

interface DispatchedEventsTypedDispatcherJsdocComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsTypedDispatcherJsdocProps>
  ): SvelteComponent<DispatchedEventsTypedDispatcherJsdocProps, $Events> & DispatchedEventsTypedDispatcherJsdocExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsTypedDispatcherJsdocProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsTypedDispatcherJsdocProps>): void;
  } & DispatchedEventsTypedDispatcherJsdocExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsTypedDispatcherJsdoc: DispatchedEventsTypedDispatcherJsdocComponent;
export default DispatchedEventsTypedDispatcherJsdoc;
