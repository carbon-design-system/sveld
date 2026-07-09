import type { Component } from "svelte";

export type Tree = {
  kind: "leaf";
  value: number
} | {
  kind: "node";
  children: Tree[]
};

export type TypedefDiscriminatedUnionRecursiveProps = {
  /**
   * @default { kind: "leaf", value: 0 }
   */
  tree?: Tree;
};

export type TypedefDiscriminatedUnionRecursiveExports = Record<string, never>;

declare const TypedefDiscriminatedUnionRecursive: Component<
  TypedefDiscriminatedUnionRecursiveProps,
  TypedefDiscriminatedUnionRecursiveExports,
  ""
>;
export default TypedefDiscriminatedUnionRecursive;
