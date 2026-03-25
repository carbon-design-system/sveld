<script>
  /**
   * @typedef {"asc" | "desc"} SortDirection
   * @callback SortFn
   * @param {any} a
   * @param {any} b
   * @param {SortDirection} direction
   * @returns {number}
   */

  /** @type {SortDirection} */
  export let direction = "asc";

  /** @type {SortFn} */
  export let sort = (a, b, direction) => 0;
</script>

<div />
