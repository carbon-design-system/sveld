import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

/**
 * Pairs two values.
 */
export declare function pair<A, B>(a: A, b: B): [A, B];

export type TemplateTagCommaListProps<T, U, K extends string, V> = {
  first: T;

  second: U;

  map: Record<K, V>;
};

export type TemplateTagCommaListExports = Record<string, never>;

interface TemplateTagCommaListComponent {
  new <T, U, K extends string, V>(
    options: ComponentConstructorOptions<TemplateTagCommaListProps<T, U, K, V>>
  ): SvelteComponent<TemplateTagCommaListProps<T, U, K, V>> & TemplateTagCommaListExports;
  <T, U, K extends string, V>(
    this: void,
    internals: ComponentInternals,
    props: TemplateTagCommaListProps<T, U, K, V>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TemplateTagCommaListProps<T, U, K, V>>): void;
  } & TemplateTagCommaListExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TemplateTagCommaList: TemplateTagCommaListComponent;
export default TemplateTagCommaList;
