<script>
  /**
   * @typedef {object} Config
   * @property {string} id - First declaration
   * @property {number} id - Second declaration wins
   */

  /** @type {Config} */
  export let config;
</script>

<div>{config.id}</div>
