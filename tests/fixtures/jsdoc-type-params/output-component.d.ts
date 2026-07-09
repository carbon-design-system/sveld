import type { Component } from "svelte";

export type TreeNodeId = string;

export type JsdocTypeParamsProps = Record<string, never>;

export type JsdocTypeParamsExports = {
  /**
   * Programmatically show a node by `id`.
   * By default, the matching node will be expanded, selected, and focused.
   * Use the options parameter to customize this behavior.
   * @example
   *  // Show node with all default behaviors (expand, select, focus)
   *  treeView.showNode("node-1");
   *
   *  // Expand node without selecting it
   *  treeView.showNode("node-2", { select: false });
   *
   *  // Select node without expanding or focusing
   *  treeView.showNode("node-3", { expand: false, focus: false });
   */
  showNode: (id: TreeNodeId, options?: {
      expand?: boolean;
      select?: boolean;
      focus?: boolean
    }) => void;
};

declare const JsdocTypeParams: Component<
  JsdocTypeParamsProps,
  JsdocTypeParamsExports,
  ""
>;
export default JsdocTypeParams;
