<script>
  /**
   * A `@template` above a typedef that never uses it declares a component
   * generic, not a parameter of the typedef.
   * @template {TreeNode} [Node=TreeNode]
   * @typedef {object} TreeNode
   * @property {string} [text]
   * @property {TreeNode[]} [nodes]
   */

  /** @type {ReadonlyArray<Node>} */
  export let nodes = [];
</script>
