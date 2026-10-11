import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type RunesHostDispatchProps = {
  value: any;
};

export type RunesHostDispatchExports = Record<string, never>;

type $Events = {
  change: CustomEvent<{
      count: number;
      label: string;
    }>;
  close: CustomEvent<null>;
  notify: CustomEvent<any>;
  ready: CustomEvent<"loaded">;
  tick: CustomEvent<number>;
};

interface RunesHostDispatchComponent {
  new (
    options: ComponentConstructorOptions<RunesHostDispatchProps>
  ): SvelteComponent<RunesHostDispatchProps, $Events> & RunesHostDispatchExports;
  (
    this: void,
    internals: ComponentInternals,
    props: RunesHostDispatchProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<RunesHostDispatchProps>): void;
  } & RunesHostDispatchExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesHostDispatch: RunesHostDispatchComponent;
export default RunesHostDispatch;
