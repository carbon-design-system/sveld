import type { Component } from "svelte";

export declare function wrap<T>(value: T): T[];

interface Item {
  id: string;
}

export type TypedExportFunctionGenericProps = Record<string, never>;

export type TypedExportFunctionGenericExports = {
  /**
   * Maps a value.
   */
  map: <V>(v: V) => V;

  pick: <K extends keyof Item = "id">(item: Item, key: K) => Item[K];
};

declare const TypedExportFunctionGeneric: Component<
  TypedExportFunctionGenericProps,
  TypedExportFunctionGenericExports,
  ""
>;
export default TypedExportFunctionGeneric;
