import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsEscapedProps = {
  /**
   * @default false
   */
  open?: boolean;
};

export type DispatchedEventsEscapedExports = Record<string, never>;

type $Events = { close: CustomEvent<null> };

interface DispatchedEventsEscapedComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsEscapedProps>
  ): SvelteComponent<DispatchedEventsEscapedProps, $Events> & DispatchedEventsEscapedExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsEscapedProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsEscapedProps>): void;
  } & DispatchedEventsEscapedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsEscaped: DispatchedEventsEscapedComponent;
export default DispatchedEventsEscaped;
