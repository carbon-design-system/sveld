import { SvelteComponentTyped } from "svelte";

export declare function wrap<T>(value: T): T[];

interface Item {
  id: string;
}

export type TypedExportFunctionGenericProps = Record<string, never>;

export default class TypedExportFunctionGeneric extends SvelteComponentTyped<
  TypedExportFunctionGenericProps,
  Record<string, any>,
  Record<string, never>
> {
  /**
   * Maps a value.
   */
  map: <V>(v: V) => V;

  pick: <K extends keyof Item = "id">(item: Item, key: K) => Item[K];
}
