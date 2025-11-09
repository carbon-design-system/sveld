<script>
  /** @typedef {string} TreeNodeId */
  /**
   * Programmatically show a node by `id`.
   * By default, the matching node will be expanded, selected, and focused.
   * Use the options parameter to customize this behavior.
   * @type {(id: TreeNodeId, options?: { expand?: boolean; select?: boolean; focus?: boolean }) => void}
   * @param {TreeNodeId} id - The id of the node to show
   * @param {object} [options] - Optional configuration
   * @param {boolean} [options.expand=true] - Whether to expand the node and its ancestors
   * @param {boolean} [options.select=true] - Whether to select the node
   * @param {boolean} [options.focus=true] - Whether to focus the node
   * @example
   * // Show node with all default behaviors (expand, select, focus)
   * treeView.showNode("node-1");
   *
   * // Expand node without selecting it
   * treeView.showNode("node-2", { select: false });
   *
   * // Select node without expanding or focusing
   * treeView.showNode("node-3", { expand: false, focus: false });
   */
  export function showNode(id, options = {}) {
    const { expand = true, select = true, focus = true } = options;
  }
</script>
