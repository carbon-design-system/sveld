<script context="module">
  /**
   * A plain module-level helper with its own generic, unrelated to the component.
   * @template {{ id: string | number }} T
   * @param {T} item
   * @returns {T}
   */
  function identity(item) {
    return item;
  }
</script>

<script>
  /**
   * Another helper, this time in the instance script.
   * @template U
   * @param {U[]} list
   * @returns {U | undefined}
   */
  function first(list) {
    return list[0];
  }

  /**
   * @generics {Node extends { id: string | number } = { id: string | number }} Node
   */
  export let node = /** @type {Node} */ ({ id: "1" });
</script>

<div>{node.id}</div>
