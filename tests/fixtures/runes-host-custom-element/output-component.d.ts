import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type RunesHostCustomElementProps = {
  value: any;
};

export type RunesHostCustomElementExports = Record<string, never>;

type $Events = {
  close: CustomEvent<null>;
  notify: CustomEvent<any>;
  ready: CustomEvent<"loaded">;
};

interface RunesHostCustomElementComponent {
  new (
    options: ComponentConstructorOptions<RunesHostCustomElementProps>
  ): SvelteComponent<RunesHostCustomElementProps, $Events> & RunesHostCustomElementExports;
  (
    this: void,
    internals: ComponentInternals,
    props: RunesHostCustomElementProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<RunesHostCustomElementProps>): void;
  } & RunesHostCustomElementExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesHostCustomElement: RunesHostCustomElementComponent;
export default RunesHostCustomElement;
