import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

/**
 * Keeps the nodes that match `pred`.
 */
export declare function filterNodes<T extends { id: string | number }>(nodes: T[], pred: (node: T) => boolean): T[];

export declare function indexNodes<T extends { id: string | number }, K = string>(nodes: T[], key: (node: T) => K): Map<K, T>;

export declare function wrap<T>(value: T): T[];

export type GenericsTemplateExportedFunctionScopedProps<Row extends { id: string | number }> = {
  /**
   * @template {{ id: string | number }} Row
   * @default []
   */
  rows?: Row[];
};

export type GenericsTemplateExportedFunctionScopedExports = {
  first: <U>(list: U[]) => U | undefined;
};

interface GenericsTemplateExportedFunctionScopedComponent {
  new <Row extends { id: string | number }>(
    options: ComponentConstructorOptions<GenericsTemplateExportedFunctionScopedProps<Row>>
  ): SvelteComponent<GenericsTemplateExportedFunctionScopedProps<Row>> & GenericsTemplateExportedFunctionScopedExports;
  <Row extends { id: string | number }>(
    this: void,
    internals: ComponentInternals,
    props: GenericsTemplateExportedFunctionScopedProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsTemplateExportedFunctionScopedProps<Row>>): void;
  } & GenericsTemplateExportedFunctionScopedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsTemplateExportedFunctionScoped: GenericsTemplateExportedFunctionScopedComponent;
export default GenericsTemplateExportedFunctionScoped;
