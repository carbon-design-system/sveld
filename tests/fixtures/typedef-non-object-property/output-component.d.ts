import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type RowClass = string | ((row: string) => string | undefined);

export type TypedefNonObjectPropertyProps = {
  rowClass?: RowClass;
};

export type TypedefNonObjectPropertyExports = Record<string, never>;

type $Events = {
  "click:cell": CustomEvent<{
      cell: string;
    }>;
};

interface TypedefNonObjectPropertyComponent {
  new (
    options: ComponentConstructorOptions<TypedefNonObjectPropertyProps>
  ): SvelteComponent<TypedefNonObjectPropertyProps, $Events> & TypedefNonObjectPropertyExports;
  (
    this: void,
    internals: ComponentInternals,
    props: TypedefNonObjectPropertyProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<TypedefNonObjectPropertyProps>): void;
  } & TypedefNonObjectPropertyExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TypedefNonObjectProperty: TypedefNonObjectPropertyComponent;
export default TypedefNonObjectProperty;
