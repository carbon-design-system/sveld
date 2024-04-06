<script>
  /**
   * @typedef {{ [key: string]: boolean; }} MyTypedef
   */

  export let id = "id-" + Math.random().toString(36);

  /** @type {MyTypedef} */
  export let prop1 = { ["1"]: true };
</script>

<div {id}>
  <slot {prop1} />
</div>
