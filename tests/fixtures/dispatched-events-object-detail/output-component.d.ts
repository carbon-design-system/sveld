import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsObjectDetailProps = {
  id: string;
};

export type DispatchedEventsObjectDetailExports = Record<string, never>;

type $Events = {
  items: CustomEvent<number[]>;
  save: CustomEvent<{ id: string }>;
};

interface DispatchedEventsObjectDetailComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsObjectDetailProps>
  ): SvelteComponent<DispatchedEventsObjectDetailProps, $Events> & DispatchedEventsObjectDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsObjectDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsObjectDetailProps>): void;
  } & DispatchedEventsObjectDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsObjectDetail: DispatchedEventsObjectDetailComponent;
export default DispatchedEventsObjectDetail;
