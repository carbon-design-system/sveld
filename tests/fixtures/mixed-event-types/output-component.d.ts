import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type MixedEventTypesProps = Record<string, never>;

export type MixedEventTypesExports = Record<string, never>;

type $Events = {
  change: WindowEventMap["change"];
  /** Custom event from component (component forwarded event) */
  customEvent: CustomEvent<number>;
  /** Input value changed (native forwarded event) */
  input: CustomEvent<string>;
  submit: CustomEvent<{ data: string }>;
};

interface MixedEventTypesComponent {
  new (
    options: ComponentConstructorOptions<MixedEventTypesProps>
  ): SvelteComponent<MixedEventTypesProps, $Events> & MixedEventTypesExports;
  (
    this: void,
    internals: ComponentInternals,
    props: MixedEventTypesProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<MixedEventTypesProps>): void;
  } & MixedEventTypesExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const MixedEventTypes: MixedEventTypesComponent;
export default MixedEventTypes;
