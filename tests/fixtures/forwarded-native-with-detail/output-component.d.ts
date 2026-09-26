import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedNativeWithDetailProps = Record<string, never>;

export type ForwardedNativeWithDetailExports = Record<string, never>;

type $Events = {
  /** The input value when changed */
  change: CustomEvent<string>;
};

interface ForwardedNativeWithDetailComponent {
  new (
    options: ComponentConstructorOptions<ForwardedNativeWithDetailProps>
  ): SvelteComponent<ForwardedNativeWithDetailProps, $Events> & ForwardedNativeWithDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedNativeWithDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedNativeWithDetailProps>): void;
  } & ForwardedNativeWithDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedNativeWithDetail: ForwardedNativeWithDetailComponent;
export default ForwardedNativeWithDetail;
