import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type RunesNonIdentifierPropNamesProps = {
  "data-foo": any;

  "123abc": any;

  normal: any;

  "icon-left"?: (this: void) => void;
};

export type RunesNonIdentifierPropNamesExports = Record<string, never>;

type $Events = { "item:select": CustomEvent<null> };

interface RunesNonIdentifierPropNamesComponent {
  new (
    options: ComponentConstructorOptions<RunesNonIdentifierPropNamesProps>
  ): SvelteComponent<RunesNonIdentifierPropNamesProps, $Events> & RunesNonIdentifierPropNamesExports;
  (
    this: void,
    internals: ComponentInternals,
    props: RunesNonIdentifierPropNamesProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<RunesNonIdentifierPropNamesProps>): void;
  } & RunesNonIdentifierPropNamesExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesNonIdentifierPropNames: RunesNonIdentifierPropNamesComponent;
export default RunesNonIdentifierPropNames;
