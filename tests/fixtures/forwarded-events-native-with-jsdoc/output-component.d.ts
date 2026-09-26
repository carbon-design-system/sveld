import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsNativeWithJsdocProps = {
  children?: (this: void) => void;
};

export type ForwardedEventsNativeWithJsdocExports = Record<string, never>;

type $Events = {
  /** Fired when the button loses focus */
  blur: WindowEventMap["blur"];
  /** Fired when the button is clicked */
  click: WindowEventMap["click"];
  /** Fired when the button receives focus */
  focus: WindowEventMap["focus"];
};

interface ForwardedEventsNativeWithJsdocComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsNativeWithJsdocProps>
  ): SvelteComponent<ForwardedEventsNativeWithJsdocProps, $Events> & ForwardedEventsNativeWithJsdocExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsNativeWithJsdocProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsNativeWithJsdocProps>): void;
  } & ForwardedEventsNativeWithJsdocExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEventsNativeWithJsdoc: ForwardedEventsNativeWithJsdocComponent;
export default ForwardedEventsNativeWithJsdoc;
