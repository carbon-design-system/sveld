import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsSvelteWindowProps = Record<string, never>;

export type ForwardedEventsSvelteWindowExports = Record<string, never>;

type $Events = {
  click: WindowEventMap["click"];
  keydown: WindowEventMap["keydown"];
};

interface ForwardedEventsSvelteWindowComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsSvelteWindowProps>
  ): SvelteComponent<ForwardedEventsSvelteWindowProps, $Events> & ForwardedEventsSvelteWindowExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsSvelteWindowProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsSvelteWindowProps>): void;
  } & ForwardedEventsSvelteWindowExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEventsSvelteWindow: ForwardedEventsSvelteWindowComponent;
export default ForwardedEventsSvelteWindow;
