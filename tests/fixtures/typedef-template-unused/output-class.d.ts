import { SvelteComponentTyped } from "svelte";

export type TreeNode = {
  text?: string;
  nodes?: TreeNode[];
};

export type TypedefTemplateUnusedProps<Node extends TreeNode = TreeNode> = {
  /**
   * @default []
   */
  nodes?: ReadonlyArray<Node>;
};

export default class TypedefTemplateUnused<Node extends TreeNode = TreeNode> extends SvelteComponentTyped<
  TypedefTemplateUnusedProps<Node>,
  Record<string, any>,
  Record<string, never>
> {}
