<script context="module">
  /**
   * Keeps the nodes that match `pred`.
   * @template {{ id: string | number }} T
   * @param {T[]} nodes
   * @param {(node: T) => boolean} pred
   * @returns {T[]}
   */
  export function filterNodes(nodes, pred) {
    return nodes.filter(pred);
  }

  /**
   * @template {{ id: string | number }} T
   * @template [K=string]
   * @param {T[]} nodes
   * @param {(node: T) => K} key
   * @returns {Map<K, T>}
   */
  export const indexNodes = (nodes, key) => new Map(nodes.map((node) => [key(node), node]));

  /**
   * @template T
   * @param {T} value
   * @returns {T[]}
   */
  export const wrap = (value) => [value];
</script>

<script>
  /**
   * @template U
   * @param {U[]} list
   * @returns {U | undefined}
   */
  export function first(list) {
    return list[0];
  }

  /**
   * @template {{ id: string | number }} Row
   * @type {Row[]}
   */
  export let rows = [];
</script>

{#each rows as row}
  {row.id}
{/each}
