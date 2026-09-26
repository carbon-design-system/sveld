import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsEscapedUnfollowableProps = Record<string, never>;

export type DispatchedEventsEscapedUnfollowableExports = Record<string, never>;

type $Events = {
  /** Fired by `registry.track`. */
  open: CustomEvent<null>;
};

interface DispatchedEventsEscapedUnfollowableComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsEscapedUnfollowableProps>
  ): SvelteComponent<DispatchedEventsEscapedUnfollowableProps, $Events> & DispatchedEventsEscapedUnfollowableExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsEscapedUnfollowableProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsEscapedUnfollowableProps>): void;
  } & DispatchedEventsEscapedUnfollowableExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsEscapedUnfollowable: DispatchedEventsEscapedUnfollowableComponent;
export default DispatchedEventsEscapedUnfollowable;
