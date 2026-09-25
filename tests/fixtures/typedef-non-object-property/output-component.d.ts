import type { Component } from "svelte";

export type RowClass = string | ((row: string) => string | undefined);

export type TypedefNonObjectPropertyProps = {
  /**
   * @default undefined
   */
  rowClass?: RowClass;

  "onclick:cell"?: (event: CustomEvent<{
        cell: string;
      }>) => void;
};

export type TypedefNonObjectPropertyExports = Record<string, never>;

declare const TypedefNonObjectProperty: Component<
  TypedefNonObjectPropertyProps,
  TypedefNonObjectPropertyExports,
  ""
>;
export default TypedefNonObjectProperty;
