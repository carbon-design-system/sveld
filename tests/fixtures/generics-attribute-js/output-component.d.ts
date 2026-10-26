import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export interface Row {
  id: string
}

export type GenericsAttributeJsProps<R extends Row = Row> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<R>;

  children?: (this: void, ...args: [{ rows: ReadonlyArray<R> }]) => void;
};

export type GenericsAttributeJsExports = Record<string, never>;

interface GenericsAttributeJsComponent {
  new <R extends Row = Row>(
    options: ComponentConstructorOptions<GenericsAttributeJsProps<R>>
  ): SvelteComponent<GenericsAttributeJsProps<R>> & GenericsAttributeJsExports;
  <R extends Row = Row>(
    this: void,
    internals: ComponentInternals,
    props: GenericsAttributeJsProps<R>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsAttributeJsProps<R>>): void;
  } & GenericsAttributeJsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsAttributeJs: GenericsAttributeJsComponent;
export default GenericsAttributeJs;
