import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsStringLiteralDetailProps = Record<string, never>;

export type DispatchedEventsStringLiteralDetailExports = Record<string, never>;

type $Events = { status: CustomEvent<"done"> };

interface DispatchedEventsStringLiteralDetailComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsStringLiteralDetailProps>
  ): SvelteComponent<DispatchedEventsStringLiteralDetailProps, $Events> & DispatchedEventsStringLiteralDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsStringLiteralDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsStringLiteralDetailProps>): void;
  } & DispatchedEventsStringLiteralDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsStringLiteralDetail: DispatchedEventsStringLiteralDetailComponent;
export default DispatchedEventsStringLiteralDetail;
