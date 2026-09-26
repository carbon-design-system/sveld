import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsObjectDetailUnknownKeysProps = Record<string, never>;

export type DispatchedEventsObjectDetailUnknownKeysExports = Record<string, never>;

type $Events = {
  computed: CustomEvent<Record<string, any>>;
  empty: CustomEvent<Record<string, never>>;
  mixed: CustomEvent<{
      id: number;
      [key: string]: any;
    }>;
  spread: CustomEvent<Record<string, any>>;
};

interface DispatchedEventsObjectDetailUnknownKeysComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsObjectDetailUnknownKeysProps>
  ): SvelteComponent<DispatchedEventsObjectDetailUnknownKeysProps, $Events> & DispatchedEventsObjectDetailUnknownKeysExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsObjectDetailUnknownKeysProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsObjectDetailUnknownKeysProps>): void;
  } & DispatchedEventsObjectDetailUnknownKeysExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsObjectDetailUnknownKeys: DispatchedEventsObjectDetailUnknownKeysComponent;
export default DispatchedEventsObjectDetailUnknownKeys;
