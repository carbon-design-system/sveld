import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedAndForwardedSameEventNameProps = Record<string, never>;

export type DispatchedAndForwardedSameEventNameExports = Record<string, never>;

type $Events = { click: CustomEvent<{ x: number }> };

interface DispatchedAndForwardedSameEventNameComponent {
  new (
    options: ComponentConstructorOptions<DispatchedAndForwardedSameEventNameProps>
  ): SvelteComponent<DispatchedAndForwardedSameEventNameProps, $Events> & DispatchedAndForwardedSameEventNameExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedAndForwardedSameEventNameProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedAndForwardedSameEventNameProps>): void;
  } & DispatchedAndForwardedSameEventNameExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedAndForwardedSameEventName: DispatchedAndForwardedSameEventNameComponent;
export default DispatchedAndForwardedSameEventName;
