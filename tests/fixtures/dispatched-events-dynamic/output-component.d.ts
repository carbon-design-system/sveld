import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsDynamicProps = Record<string, never>;

export type DispatchedEventsDynamicExports = Record<string, never>;

type $Events = { KEY: CustomEvent<{ key: string }> };

interface DispatchedEventsDynamicComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsDynamicProps>
  ): SvelteComponent<DispatchedEventsDynamicProps, $Events> & DispatchedEventsDynamicExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsDynamicProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsDynamicProps>): void;
  } & DispatchedEventsDynamicExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsDynamic: DispatchedEventsDynamicComponent;
export default DispatchedEventsDynamic;
