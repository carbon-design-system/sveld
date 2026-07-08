import { SvelteComponentTyped } from "svelte";

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

export default class TypedefDiscriminatedUnionRecursive extends SvelteComponentTyped<
  TypedefDiscriminatedUnionRecursiveProps,
  Record<string, any>,
  Record<string, never>
> {}
