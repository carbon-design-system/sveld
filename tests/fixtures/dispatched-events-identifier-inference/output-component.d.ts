import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

type Item = { id: string };

export type DispatchedEventsIdentifierInferenceProps = Record<string, never>;

export type DispatchedEventsIdentifierInferenceExports = Record<string, never>;

type $Events = {
  change: CustomEvent<{
      count: number;
      label: string;
      open: boolean;
    }>;
  count: CustomEvent<number>;
  items: CustomEvent<Item[]>;
  rename: CustomEvent<{ label: any }>;
  reroll: CustomEvent<{ roll: any }>;
  roll: CustomEvent<any>;
  select: CustomEvent<{ selected: Item | undefined }>;
  update: CustomEvent<{
      total: number;
      items: Item[];
      doubled: number;
    }>;
};

interface DispatchedEventsIdentifierInferenceComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsIdentifierInferenceProps>
  ): SvelteComponent<DispatchedEventsIdentifierInferenceProps, $Events> & DispatchedEventsIdentifierInferenceExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsIdentifierInferenceProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsIdentifierInferenceProps>): void;
  } & DispatchedEventsIdentifierInferenceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsIdentifierInference: DispatchedEventsIdentifierInferenceComponent;
export default DispatchedEventsIdentifierInference;
