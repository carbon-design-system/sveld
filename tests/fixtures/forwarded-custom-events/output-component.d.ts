import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedCustomEventsProps = Record<string, never>;

export type ForwardedCustomEventsExports = Record<string, never>;

type $Events = {
  /** Fired when clear button is clicked */
  clear: CustomEvent<KeyboardEvent | MouseEvent>;
  click: WindowEventMap["click"];
};

interface ForwardedCustomEventsComponent {
  new (
    options: ComponentConstructorOptions<ForwardedCustomEventsProps>
  ): SvelteComponent<ForwardedCustomEventsProps, $Events> & ForwardedCustomEventsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedCustomEventsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedCustomEventsProps>): void;
  } & ForwardedCustomEventsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedCustomEvents: ForwardedCustomEventsComponent;
export default ForwardedCustomEvents;
