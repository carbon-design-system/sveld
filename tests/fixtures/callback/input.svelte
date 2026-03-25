<script>
  /**
   * Callback fired when the value changes.
   * @callback OnChange
   * @param {string} value - The new value.
   * @param {number} index - The index of the changed item.
   * @returns {void}
   */

  /**
   * @callback Comparator
   * @param {any} a
   * @param {any} b
   * @returns {number}
   */

  /**
   * No-arg callback.
   * @callback OnClose
   */

  /** @type {OnChange} */
  export let onChange = (value, index) => {};

  /** @type {Comparator} */
  export let comparator = (a, b) => a - b;

  /** @type {OnClose} */
  export let onClose = () => {};
</script>

<div />
