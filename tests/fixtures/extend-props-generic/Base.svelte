<script>
  /**
   * @template [T=any]
   */

  /**
   * Specify the rows.
   * @type {ReadonlyArray<T>}
   */
  export let data = [];

  /**
   * Specify the x accessor: a property name or a function.
   * @type {(keyof T & string) | ((row: T, index: number) => number | string)}
   */
  export let x;
</script>

<svg>
  {#each data as row, i}
    <text>{typeof x === "function" ? x(row, i) : row[x]}</text>
  {/each}
</svg>
