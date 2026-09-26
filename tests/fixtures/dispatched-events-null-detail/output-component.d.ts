import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsNullDetailProps = Record<string, never>;

export type DispatchedEventsNullDetailExports = Record<string, never>;

type $Events = { clear: CustomEvent<null> };

interface DispatchedEventsNullDetailComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsNullDetailProps>
  ): SvelteComponent<DispatchedEventsNullDetailProps, $Events> & DispatchedEventsNullDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsNullDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsNullDetailProps>): void;
  } & DispatchedEventsNullDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsNullDetail: DispatchedEventsNullDetailComponent;
export default DispatchedEventsNullDetail;
