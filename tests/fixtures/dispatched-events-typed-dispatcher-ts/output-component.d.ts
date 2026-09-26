import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsTypedDispatcherTsProps = Record<string, never>;

export type DispatchedEventsTypedDispatcherTsExports = Record<string, never>;

type $Events = {
  cancel: CustomEvent<null>;
  save: CustomEvent<{ id: string }>;
};

interface DispatchedEventsTypedDispatcherTsComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsTypedDispatcherTsProps>
  ): SvelteComponent<DispatchedEventsTypedDispatcherTsProps, $Events> & DispatchedEventsTypedDispatcherTsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsTypedDispatcherTsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsTypedDispatcherTsProps>): void;
  } & DispatchedEventsTypedDispatcherTsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsTypedDispatcherTs: DispatchedEventsTypedDispatcherTsComponent;
export default DispatchedEventsTypedDispatcherTs;
