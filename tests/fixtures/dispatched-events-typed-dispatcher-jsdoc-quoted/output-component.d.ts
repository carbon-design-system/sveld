import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocQuotedProps = Record<string, never>;

export type DispatchedEventsTypedDispatcherJsdocQuotedExports = Record<string, never>;

type $Events = {
  "a;b": CustomEvent<number>;
  "change:value": CustomEvent<string>;
  plain: CustomEvent<null>;
};

interface DispatchedEventsTypedDispatcherJsdocQuotedComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsTypedDispatcherJsdocQuotedProps>
  ): SvelteComponent<DispatchedEventsTypedDispatcherJsdocQuotedProps, $Events> & DispatchedEventsTypedDispatcherJsdocQuotedExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsTypedDispatcherJsdocQuotedProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsTypedDispatcherJsdocQuotedProps>): void;
  } & DispatchedEventsTypedDispatcherJsdocQuotedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsTypedDispatcherJsdocQuoted: DispatchedEventsTypedDispatcherJsdocQuotedComponent;
export default DispatchedEventsTypedDispatcherJsdocQuoted;
