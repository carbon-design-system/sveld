import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type RunesHostDispatchDetailInferenceProps = Record<string, never>;

export type RunesHostDispatchDetailInferenceExports = Record<string, never>;

type $Events = {
  change: CustomEvent<{
      count: number;
      label: string;
    }>;
  tick: CustomEvent<number>;
};

interface RunesHostDispatchDetailInferenceComponent {
  new (
    options: ComponentConstructorOptions<RunesHostDispatchDetailInferenceProps>
  ): SvelteComponent<RunesHostDispatchDetailInferenceProps, $Events> & RunesHostDispatchDetailInferenceExports;
  (
    this: void,
    internals: ComponentInternals,
    props: RunesHostDispatchDetailInferenceProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<RunesHostDispatchDetailInferenceProps>): void;
  } & RunesHostDispatchDetailInferenceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesHostDispatchDetailInference: RunesHostDispatchDetailInferenceComponent;
export default RunesHostDispatchDetailInference;
