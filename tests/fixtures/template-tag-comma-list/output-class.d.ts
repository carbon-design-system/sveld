import { SvelteComponentTyped } from "svelte";

/**
 * Pairs two values.
 */
export declare function pair<A, B>(a: A, b: B): [A, B];

export type TemplateTagCommaListProps<T, U, K extends string, V> = {
  first: T;

  second: U;

  map: Record<K, V>;
};

export default class TemplateTagCommaList<T, U, K extends string, V> extends SvelteComponentTyped<
  TemplateTagCommaListProps<T, U, K, V>,
  Record<string, any>,
  Record<string, never>
> {}
