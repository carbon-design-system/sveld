<script context="module">
  export const tree = false;

  export function computeTreeLeafDepth(node) {
    let depth = 0;
    if (node == null) return depth;
    let parentNode = node.parentNode;
    while (parentNode != null && parentNode.getAttribute("role") !== "tree") {
      parentNode = parentNode.parentNode;
      if (parentNode.tagName === "LI") depth++;
    }
    return depth;
  }
  
  /**
   * Finds the nearest parent tree node
   * @type {(node: HTMLElement) => null | HTMLElement}
   */
  export function findParentTreeNode(node) {
    if (node.classList.contains("bx--tree-parent-node")) return node;
    if (node.classList.contains("bx--tree")) return null;
    return findParentTreeNode(node.parentNode);
  }
</script>

<script lang="ts">
  export let type = "button" as const;
  export let primary = false;

  $: findParentTreeNode(null)
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
