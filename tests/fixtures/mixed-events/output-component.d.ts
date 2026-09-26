import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type MixedEventsProps = Record<string, never>;

export type MixedEventsExports = Record<string, never>;

type $Events = {
  blur: FocusEvent | CustomEvent<FocusEvent>;
  "custom-focus": CustomEvent<FocusEvent | number>;
};

interface MixedEventsComponent {
  new (
    options: ComponentConstructorOptions<MixedEventsProps>
  ): SvelteComponent<MixedEventsProps, $Events> & MixedEventsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: MixedEventsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<MixedEventsProps>): void;
  } & MixedEventsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const MixedEvents: MixedEventsComponent;
export default MixedEvents;
