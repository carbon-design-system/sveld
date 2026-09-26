import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedFromComponentToNativeProps = Record<string, never>;

export type ForwardedFromComponentToNativeExports = Record<string, never>;

type $Events = {
  click: WindowEventMap["click"];
  collapse: CustomEvent<null>;
  expand: CustomEvent<null>;
  mouseenter: WindowEventMap["mouseenter"];
  mouseleave: WindowEventMap["mouseleave"];
  mouseover: WindowEventMap["mouseover"];
};

interface ForwardedFromComponentToNativeComponent {
  new (
    options: ComponentConstructorOptions<ForwardedFromComponentToNativeProps>
  ): SvelteComponent<ForwardedFromComponentToNativeProps, $Events> & ForwardedFromComponentToNativeExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedFromComponentToNativeProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedFromComponentToNativeProps>): void;
  } & ForwardedFromComponentToNativeExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedFromComponentToNative: ForwardedFromComponentToNativeComponent;
export default ForwardedFromComponentToNative;
