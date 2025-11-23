<script>
  /**
   * @typedef {{ [key: string]: boolean; }} MyTypedef
   * @typedef {MyTypedef[]} MyTypedefArray
   */

  /** @type {MyTypedef} */
  export let prop1 = { 1: true };

  /** @type {MyTypedefArray} */
  export let prop2 = [];
</script>

<div>
  <slot {prop1} {prop2} />
</div>
