import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type EventJsdocSinceProps = {
  /**
   * @default ""
   */
  value?: string;
};

export type EventJsdocSinceExports = Record<string, never>;

type $Events = {
  /**
   * Fired when the value changes.
   * @since 1.1.0
   * @example
   * ```svelte
   * <Field on:change={(e) => console.log(e.detail)} />
   * ```
   */
  change: CustomEvent<string>;
};

interface EventJsdocSinceComponent {
  new (
    options: ComponentConstructorOptions<EventJsdocSinceProps>
  ): SvelteComponent<EventJsdocSinceProps, $Events> & EventJsdocSinceExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventJsdocSinceProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventJsdocSinceProps>): void;
  } & EventJsdocSinceExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventJsdocSince: EventJsdocSinceComponent;
export default EventJsdocSince;
