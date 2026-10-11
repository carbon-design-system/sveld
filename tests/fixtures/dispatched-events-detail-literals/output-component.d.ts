import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsDetailLiteralsProps = {
  id: string;
};

export type DispatchedEventsDetailLiteralsExports = Record<string, never>;

type $Events = {
  clear: CustomEvent<null>;
  items: CustomEvent<number[]>;
  save: CustomEvent<{ id: string }>;
  status: CustomEvent<"done">;
};

interface DispatchedEventsDetailLiteralsComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsDetailLiteralsProps>
  ): SvelteComponent<DispatchedEventsDetailLiteralsProps, $Events> & DispatchedEventsDetailLiteralsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsDetailLiteralsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsDetailLiteralsProps>): void;
  } & DispatchedEventsDetailLiteralsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsDetailLiterals: DispatchedEventsDetailLiteralsComponent;
export default DispatchedEventsDetailLiterals;
