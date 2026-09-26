import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedAndForwardedSameEventNameHostDispatchProps = Record<string, never>;

export type DispatchedAndForwardedSameEventNameHostDispatchExports = Record<string, never>;

type $Events = { click: CustomEvent<1> };

interface DispatchedAndForwardedSameEventNameHostDispatchComponent {
  new (
    options: ComponentConstructorOptions<DispatchedAndForwardedSameEventNameHostDispatchProps>
  ): SvelteComponent<DispatchedAndForwardedSameEventNameHostDispatchProps, $Events> & DispatchedAndForwardedSameEventNameHostDispatchExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedAndForwardedSameEventNameHostDispatchProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedAndForwardedSameEventNameHostDispatchProps>): void;
  } & DispatchedAndForwardedSameEventNameHostDispatchExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedAndForwardedSameEventNameHostDispatch: DispatchedAndForwardedSameEventNameHostDispatchComponent;
export default DispatchedAndForwardedSameEventNameHostDispatch;
