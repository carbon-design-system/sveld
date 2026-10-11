import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsJsdocDescriptionProps = Record<string, never>;

export type ForwardedEventsJsdocDescriptionExports = Record<string, never>;

type $Events = {
  blur: WindowEventMap["blur"];
  /** Fired when the button is clicked */
  click: WindowEventMap["click"];
  /** Fired when the button receives focus */
  focus: WindowEventMap["focus"];
};

interface ForwardedEventsJsdocDescriptionComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsJsdocDescriptionProps>
  ): SvelteComponent<ForwardedEventsJsdocDescriptionProps, $Events> & ForwardedEventsJsdocDescriptionExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsJsdocDescriptionProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsJsdocDescriptionProps>): void;
  } & ForwardedEventsJsdocDescriptionExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEventsJsdocDescription: ForwardedEventsJsdocDescriptionComponent;
export default ForwardedEventsJsdocDescription;
