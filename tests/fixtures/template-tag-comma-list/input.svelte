<script context="module">
  /**
   * Pairs two values.
   * @template A, B
   * @param {A} a
   * @param {B} b
   * @returns {[A, B]}
   */
  export function pair(a, b) {
    return [a, b];
  }
</script>

<script>
  /**
   * @template T,U
   * @template {string} K, V The key and value types
   */

  /** @type {T} */
  export let first;

  /** @type {U} */
  export let second;

  /** @type {Record<K, V>} */
  export let map;
</script>
