import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type EventUntypedJsdocDispatchDetailProps = Record<string, never>;

export type EventUntypedJsdocDispatchDetailExports = Record<string, never>;

type $Events = {
  /** Fired on close. */
  close: CustomEvent<{ reason: string }>;
  /** Fired on open. */
  open: CustomEvent<null>;
  /** Fired on reset. */
  reset: CustomEvent<null>;
  /** Fired on toggle. */
  toggle: CustomEvent<null>;
};

interface EventUntypedJsdocDispatchDetailComponent {
  new (
    options: ComponentConstructorOptions<EventUntypedJsdocDispatchDetailProps>
  ): SvelteComponent<EventUntypedJsdocDispatchDetailProps, $Events> & EventUntypedJsdocDispatchDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventUntypedJsdocDispatchDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventUntypedJsdocDispatchDetailProps>): void;
  } & EventUntypedJsdocDispatchDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventUntypedJsdocDispatchDetail: EventUntypedJsdocDispatchDetailComponent;
export default EventUntypedJsdocDispatchDetail;
