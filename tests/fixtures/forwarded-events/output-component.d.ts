import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsProps = {
  children?: (this: void) => void;
};

export type ForwardedEventsExports = Record<string, never>;

type $Events = {
  blur: WindowEventMap["blur"];
  click: WindowEventMap["click"];
  focus: WindowEventMap["focus"];
  mouseover: WindowEventMap["mouseover"];
};

interface ForwardedEventsComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsProps>
  ): SvelteComponent<ForwardedEventsProps, $Events> & ForwardedEventsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsProps>): void;
  } & ForwardedEventsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEvents: ForwardedEventsComponent;
export default ForwardedEvents;
