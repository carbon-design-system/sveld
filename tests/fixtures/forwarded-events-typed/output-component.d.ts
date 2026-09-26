import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsTypedProps = Record<string, never>;

export type ForwardedEventsTypedExports = Record<string, never>;

type $Events = {
  blur: WindowEventMap["blur"];
  /** Fired when the button is clicked */
  click: WindowEventMap["click"];
  /** Fired when the button receives focus */
  focus: WindowEventMap["focus"];
};

interface ForwardedEventsTypedComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsTypedProps>
  ): SvelteComponent<ForwardedEventsTypedProps, $Events> & ForwardedEventsTypedExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsTypedProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsTypedProps>): void;
  } & ForwardedEventsTypedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEventsTyped: ForwardedEventsTypedComponent;
export default ForwardedEventsTyped;
