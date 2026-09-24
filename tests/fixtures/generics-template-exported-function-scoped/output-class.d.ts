import { SvelteComponentTyped } from "svelte";

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

export default class GenericsTemplateExportedFunctionScoped<Row extends { id: string | number }> extends SvelteComponentTyped<
  GenericsTemplateExportedFunctionScopedProps<Row>,
  Record<string, any>,
  Record<string, never>
> {
  first: <U>(list: U[]) => U | undefined;
}
