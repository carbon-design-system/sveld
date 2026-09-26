import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsJsdocUnionTypeProps = Record<string, never>;

export type DispatchedEventsJsdocUnionTypeExports = Record<string, never>;

type $Events = {
  /** Dispatched when a sortable column header would change the active sort. */
  sort: CustomEvent<{
      key: null;
      direction: "none"
    } | {
      key: string;
      direction: "ascending" | "descending"
    }>;
};

interface DispatchedEventsJsdocUnionTypeComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsJsdocUnionTypeProps>
  ): SvelteComponent<DispatchedEventsJsdocUnionTypeProps, $Events> & DispatchedEventsJsdocUnionTypeExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsJsdocUnionTypeProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsJsdocUnionTypeProps>): void;
  } & DispatchedEventsJsdocUnionTypeExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsJsdocUnionType: DispatchedEventsJsdocUnionTypeComponent;
export default DispatchedEventsJsdocUnionType;
