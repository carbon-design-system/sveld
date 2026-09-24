<script>
  /**
   * Formats a value.
   * @param {string} value
   * @returns {string}
   */
  export const format = (value) => value.trim();

  /**
   * @template T
   * @param {T} value
   * @returns {T}
   */
  export const identity = (value) => value;

  /** @type {number} */
  export let size = 1;
</script>

<p>{format(String(identity(size)))}</p>
